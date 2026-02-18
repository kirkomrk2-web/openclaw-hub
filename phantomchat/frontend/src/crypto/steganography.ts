/**
 * PhantomChat Steganography Module — PNG + Reed-Solomon Error Correction
 *
 * Hides encrypted messages inside PNG images using Least Significant Bit (LSB)
 * encoding with Reed-Solomon error correction for robustness.
 *
 * DESIGN DECISIONS:
 *   1. PNG ONLY — We reject JPEG/WebP because they use lossy compression
 *      that destroys LSB data. PNG is lossless, so our embedded bits survive.
 *
 *   2. CAPACITY LIMIT — We use at most 10% of the total pixel count to store
 *      data. This keeps statistical detectability low: chi-squared tests and
 *      RS steganalysis are much less effective when payload is ≤10%.
 *
 *   3. REED-SOLOMON ERROR CORRECTION — Before LSB encoding, we apply RS(255,247)
 *      error correction (8 parity symbols per 247 data symbols). This means
 *      if up to 4 symbols per block are corrupted (e.g. by minor PNG re-encoding
 *      or pixel rounding), the data can still be recovered perfectly.
 *
 *   4. DATA FORMAT — The hidden payload structure is:
 *      [4 bytes: payload length (big-endian)] [N bytes: RS-encoded data]
 *      Each byte is spread across 8 pixels (1 bit per pixel's LSB of blue channel).
 *
 * SECURITY: The data embedded should ALREADY be encrypted before calling
 * embedInImage(). This module handles hiding, not encryption.
 */

/* ═══════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════ */

/** Result of image analysis for steganographic capacity */
export interface StegoCapacity {
  /** Total pixels in the image */
  totalPixels: number;
  /** Maximum bytes we can hide (10% of pixels / 8 bits per byte, minus RS overhead) */
  maxPayloadBytes: number;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
}

/** Options for embed operation */
export interface EmbedOptions {
  /** The encrypted payload to hide (Uint8Array) */
  payload: Uint8Array;
  /** The cover image as PNG (ImageData from canvas) */
  imageData: ImageData;
}

/** Result of extraction */
export interface ExtractResult {
  /** The extracted (and RS-decoded) payload */
  payload: Uint8Array;
  /** Whether RS correction was needed */
  correctionApplied: boolean;
  /** Number of symbols corrected (0 if none) */
  symbolsCorrected: number;
}

/* ═══════════════════════════════════════════
   REED-SOLOMON IMPLEMENTATION
   ═══════════════════════════════════════════

   Reed-Solomon codes operate over GF(2^8) — the Galois Field with 256
   elements. Each "symbol" is one byte (0-255).

   RS(255, 247) means:
     - Block size: 255 symbols (bytes)
     - Data symbols: 247 per block
     - Parity symbols: 8 per block
     - Error correction capability: up to 4 symbol errors per block
       (because RS can correct up to t = parityCount/2 errors)

   The implementation uses the standard irreducible polynomial for GF(2^8):
     x^8 + x^4 + x^3 + x^2 + 1  (0x11D)

   The generator polynomial for 8 parity symbols is:
     g(x) = (x - α^0)(x - α^1)...(x - α^7)
   where α is the primitive element of GF(2^8).
*/

const GF_SIZE = 256;
const GF_PRIMITIVE_POLY = 0x11d; // x^8 + x^4 + x^3 + x^2 + 1
const RS_TOTAL_SYMBOLS = 255;
const RS_PARITY_SYMBOLS = 8;
const RS_DATA_SYMBOLS = RS_TOTAL_SYMBOLS - RS_PARITY_SYMBOLS; // 247

/**
 * Precomputed GF(2^8) logarithm and exponential tables.
 *
 * These tables let us do multiplication and division in GF(2^8)
 * using table lookups instead of bit-by-bit polynomial arithmetic:
 *   a * b = exp_table[(log_table[a] + log_table[b]) % 255]
 *   a / b = exp_table[(log_table[a] - log_table[b] + 255) % 255]
 *
 * The exponential table is indexed by the discrete logarithm base α,
 * where α is a primitive element (generator) of GF(2^8).
 */
const gfExpTable = new Uint8Array(512); // doubled for wraparound convenience
const gfLogTable = new Uint8Array(256);

function initGaloisTables(): void {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    gfExpTable[i] = x;
    gfLogTable[x] = i;
    // Multiply by α (which is 2 in our field representation)
    x = x << 1;
    if (x >= GF_SIZE) {
      x ^= GF_PRIMITIVE_POLY;
    }
  }
  // Fill the second half of exp table for easy modular lookups
  for (let i = 255; i < 512; i++) {
    gfExpTable[i] = gfExpTable[i - 255];
  }
}

// Initialize tables at module load
initGaloisTables();

/**
 * Multiply two elements in GF(2^8).
 * Returns 0 if either operand is 0 (special case: log(0) is undefined).
 */
function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return gfExpTable[gfLogTable[a] + gfLogTable[b]];
}

/**
 * Divide two elements in GF(2^8).
 * @throws if b is 0 (division by zero in any field)
 */
function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error('GF(2^8) division by zero');
  if (a === 0) return 0;
  return gfExpTable[(gfLogTable[a] - gfLogTable[b] + 255) % 255];
}

/**
 * Evaluate a polynomial at a given point in GF(2^8) using Horner's method.
 *
 * The polynomial is represented as an array where index 0 is the highest
 * degree coefficient: poly[0]*x^(n-1) + poly[1]*x^(n-2) + ... + poly[n-1]
 *
 * @param poly  - Polynomial coefficients (high degree first)
 * @param x     - The point to evaluate at (in GF(2^8))
 * @returns The value poly(x) in GF(2^8)
 */
function gfPolyEval(poly: Uint8Array, x: number): number {
  let result = 0;
  for (let i = 0; i < poly.length; i++) {
    // In GF(2^8), addition is XOR
    result = gfMul(result, x) ^ poly[i];
  }
  return result;
}

/**
 * Multiply two polynomials over GF(2^8).
 *
 * If A has degree m and B has degree n, the result has degree m+n.
 * Each coefficient is computed as the sum (XOR) of products of
 * coefficient pairs whose degrees add up to the target degree.
 */
function gfPolyMul(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length - 1);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      // XOR because addition in GF(2^8) is XOR
      result[i + j] ^= gfMul(a[i], b[j]);
    }
  }
  return result;
}

/**
 * Build the Reed-Solomon generator polynomial for the given number of
 * parity symbols.
 *
 * g(x) = (x - α^0)(x - α^1)(x - α^2)...(x - α^(n-1))
 *
 * This polynomial has roots at α^0 through α^(n-1). When we divide the
 * data polynomial by g(x), the remainder gives us the parity symbols.
 * At decode time, evaluating the received polynomial at these roots gives
 * the "syndromes" — if all zero, no errors; otherwise they tell us where
 * and what the errors are.
 *
 * @param parityCount - Number of parity symbols (8 in our case)
 * @returns The generator polynomial coefficients
 */
function buildGeneratorPoly(parityCount: number): Uint8Array {
  let gen = new Uint8Array([1]); // Start with polynomial "1"
  for (let i = 0; i < parityCount; i++) {
    // Multiply by (x - α^i), which in GF(2^8) is (x + α^i) since -1 = 1
    gen = gfPolyMul(gen, new Uint8Array([1, gfExpTable[i]]));
  }
  return gen;
}

// Precompute the generator polynomial
const RS_GENERATOR = buildGeneratorPoly(RS_PARITY_SYMBOLS);

/**
 * Reed-Solomon ENCODE: compute parity symbols for a data block.
 *
 * Algorithm: treat data as coefficients of a polynomial D(x), multiply by
 * x^parityCount to shift it up, then compute the remainder R(x) when
 * dividing by the generator polynomial g(x). The codeword is D(x)*x^n + R(x).
 *
 * @param data - Exactly RS_DATA_SYMBOLS (247) bytes of data
 * @returns RS_TOTAL_SYMBOLS (255) bytes: data + parity
 */
function rsEncode(data: Uint8Array): Uint8Array {
  if (data.length !== RS_DATA_SYMBOLS) {
    throw new Error(`RS encode expects ${RS_DATA_SYMBOLS} bytes, got ${data.length}`);
  }

  // Start with data shifted up by parityCount positions
  const padded = new Uint8Array(RS_TOTAL_SYMBOLS);
  padded.set(data, 0);

  // Polynomial long division to compute remainder
  for (let i = 0; i < RS_DATA_SYMBOLS; i++) {
    const coeff = padded[i];
    if (coeff !== 0) {
      for (let j = 1; j < RS_GENERATOR.length; j++) {
        padded[i + j] ^= gfMul(RS_GENERATOR[j], coeff);
      }
    }
  }

  // Result: original data in first 247 positions, parity in last 8
  const codeword = new Uint8Array(RS_TOTAL_SYMBOLS);
  codeword.set(data, 0);
  codeword.set(padded.subarray(RS_DATA_SYMBOLS), RS_DATA_SYMBOLS);

  return codeword;
}

/**
 * Compute syndromes for a received RS codeword.
 *
 * Syndrome S_i = R(α^i) where R(x) is the received polynomial.
 * If all syndromes are zero, no errors exist.
 *
 * @param received - RS_TOTAL_SYMBOLS (255) bytes of received data
 * @returns Array of RS_PARITY_SYMBOLS (8) syndrome values
 */
function rsSyndromes(received: Uint8Array): Uint8Array {
  const syndromes = new Uint8Array(RS_PARITY_SYMBOLS);
  for (let i = 0; i < RS_PARITY_SYMBOLS; i++) {
    syndromes[i] = gfPolyEval(received, gfExpTable[i]);
  }
  return syndromes;
}

/**
 * Find error positions using the Berlekamp-Massey algorithm, then
 * compute error magnitudes using Forney's algorithm.
 *
 * Berlekamp-Massey finds the shortest LFSR (Linear Feedback Shift Register)
 * that produces the syndrome sequence. This LFSR is the "error locator
 * polynomial" Λ(x), whose roots (inverted) give error positions.
 *
 * Forney's algorithm then uses the syndrome polynomial and Λ(x) to compute
 * the actual error values at each position.
 *
 * @param syndromes - The syndrome values from rsSyndromes()
 * @param codewordLength - Length of the codeword (255)
 * @returns Array of {position, magnitude} for each detected error, or null if uncorrectable
 */
function rsFindErrors(
  syndromes: Uint8Array,
  codewordLength: number
): Array<{ position: number; magnitude: number }> | null {
  // Berlekamp-Massey algorithm
  let errLocator = new Uint8Array([1]); // Λ(x), starts as 1
  let oldLocator = new Uint8Array([1]);
  let delta: number;

  for (let i = 0; i < RS_PARITY_SYMBOLS; i++) {
    // Compute discrepancy
    delta = syndromes[i];
    for (let j = 1; j < errLocator.length; j++) {
      delta ^= gfMul(errLocator[errLocator.length - 1 - j], syndromes[i - j]);
    }

    // Shift oldLocator by appending 0
    const shifted = new Uint8Array(oldLocator.length + 1);
    shifted.set(oldLocator, 0);
    oldLocator = shifted;

    if (delta !== 0) {
      if (oldLocator.length > errLocator.length) {
        const newLocator = new Uint8Array(oldLocator.length);
        for (let j = 0; j < oldLocator.length; j++) {
          newLocator[j] = gfMul(oldLocator[j], delta);
        }
        oldLocator = new Uint8Array(errLocator.length);
        for (let j = 0; j < errLocator.length; j++) {
          oldLocator[j] = gfMul(errLocator[j], gfDiv(1, delta));
        }
        errLocator = newLocator;
      }

      // Update error locator
      const updated = new Uint8Array(Math.max(errLocator.length, oldLocator.length));
      updated.set(errLocator, 0);
      for (let j = 0; j < oldLocator.length; j++) {
        updated[j] ^= gfMul(oldLocator[j], delta);
      }
      errLocator = updated;
    }
  }

  // Number of errors = degree of error locator polynomial
  const numErrors = errLocator.length - 1;
  if (numErrors > RS_PARITY_SYMBOLS / 2) {
    // Too many errors to correct
    return null;
  }

  // Chien search: find roots of the error locator polynomial by brute force
  // A root at α^(-i) means error at position i
  const errorPositions: number[] = [];
  for (let i = 0; i < codewordLength; i++) {
    if (gfPolyEval(errLocator, gfExpTable[255 - i]) === 0) {
      errorPositions.push(i);
    }
  }

  if (errorPositions.length !== numErrors) {
    // Couldn't find all roots — uncorrectable
    return null;
  }

  // Forney's algorithm: compute error magnitudes
  // First, compute the "syndrome polynomial" S(x)
  // Then, the error evaluator polynomial Ω(x) = S(x)*Λ(x) mod x^(2t)
  const syndPoly = new Uint8Array(RS_PARITY_SYMBOLS + 1);
  syndPoly[0] = 1;
  for (let i = 0; i < RS_PARITY_SYMBOLS; i++) {
    syndPoly[i + 1] = syndromes[i];
  }
  const omega = gfPolyMul(syndPoly, errLocator);
  // Truncate to 2t+1 terms
  const omegaTrunc = omega.slice(0, RS_PARITY_SYMBOLS + 1);

  // Formal derivative of error locator: Λ'(x)
  // In GF(2), the derivative drops even-power terms and halves odd-power coefficients
  const locatorDeriv = new Uint8Array(errLocator.length - 1);
  for (let i = 1; i < errLocator.length; i += 2) {
    locatorDeriv[i - 1] = errLocator[i];
  }

  // Compute error magnitudes
  const errors: Array<{ position: number; magnitude: number }> = [];
  for (const pos of errorPositions) {
    const xiInv = gfExpTable[255 - pos]; // α^(-pos)
    const omegaVal = gfPolyEval(omegaTrunc, xiInv);
    const derivVal = gfPolyEval(locatorDeriv, xiInv);
    if (derivVal === 0) return null; // shouldn't happen with valid input
    const magnitude = gfMul(omegaVal, gfDiv(1, derivVal));
    errors.push({ position: pos, magnitude });
  }

  return errors;
}

/**
 * Reed-Solomon DECODE: detect and correct errors in a received codeword.
 *
 * @param received - RS_TOTAL_SYMBOLS (255) bytes of received data
 * @returns Object with corrected data (247 bytes), correction status
 */
function rsDecode(received: Uint8Array): {
  data: Uint8Array;
  corrected: boolean;
  symbolsCorrected: number;
} {
  if (received.length !== RS_TOTAL_SYMBOLS) {
    throw new Error(`RS decode expects ${RS_TOTAL_SYMBOLS} bytes, got ${received.length}`);
  }

  const syndromes = rsSyndromes(received);

  // Check if all syndromes are zero (no errors)
  let hasErrors = false;
  for (let i = 0; i < syndromes.length; i++) {
    if (syndromes[i] !== 0) {
      hasErrors = true;
      break;
    }
  }

  if (!hasErrors) {
    return {
      data: received.slice(0, RS_DATA_SYMBOLS),
      corrected: false,
      symbolsCorrected: 0,
    };
  }

  // Find and correct errors
  const errors = rsFindErrors(syndromes, RS_TOTAL_SYMBOLS);
  if (errors === null) {
    throw new Error('Reed-Solomon: uncorrectable errors detected');
  }

  // Apply corrections
  const corrected = new Uint8Array(received);
  for (const err of errors) {
    corrected[err.position] ^= err.magnitude;
  }

  return {
    data: corrected.slice(0, RS_DATA_SYMBOLS),
    corrected: true,
    symbolsCorrected: errors.length,
  };
}

/* ═══════════════════════════════════════════
   RS BLOCK ENCODING/DECODING (MULTI-BLOCK)
   ═══════════════════════════════════════════

   For payloads larger than 247 bytes, we split into multiple RS blocks.
   Each block is independently encoded/decoded.
*/

/**
 * Encode arbitrary-length data with Reed-Solomon error correction.
 * Splits input into 247-byte blocks, encodes each to 255 bytes.
 *
 * @param data - Raw data bytes
 * @returns RS-encoded data (multiple 255-byte blocks concatenated)
 */
function rsEncodeAll(data: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [];
  let offset = 0;

  while (offset < data.length) {
    const blockData = new Uint8Array(RS_DATA_SYMBOLS);
    const chunk = data.subarray(offset, offset + RS_DATA_SYMBOLS);
    blockData.set(chunk, 0);
    // If chunk is shorter than 247, the rest is zero-padded

    blocks.push(rsEncode(blockData));
    offset += RS_DATA_SYMBOLS;
  }

  // Concatenate all encoded blocks
  const totalLength = blocks.length * RS_TOTAL_SYMBOLS;
  const result = new Uint8Array(totalLength);
  for (let i = 0; i < blocks.length; i++) {
    result.set(blocks[i], i * RS_TOTAL_SYMBOLS);
  }

  return result;
}

/**
 * Decode RS-encoded data back to original, correcting errors along the way.
 *
 * @param encoded      - RS-encoded data (multiple 255-byte blocks)
 * @param originalLength - The original unpadded data length
 * @returns Decoded data and correction statistics
 */
function rsDecodeAll(
  encoded: Uint8Array,
  originalLength: number
): { data: Uint8Array; totalCorrected: number } {
  const blockCount = Math.ceil(encoded.length / RS_TOTAL_SYMBOLS);
  const decoded: Uint8Array[] = [];
  let totalCorrected = 0;

  for (let i = 0; i < blockCount; i++) {
    const block = encoded.subarray(i * RS_TOTAL_SYMBOLS, (i + 1) * RS_TOTAL_SYMBOLS);
    // Ensure block is exactly 255 bytes (pad if needed — shouldn't happen normally)
    const fullBlock = new Uint8Array(RS_TOTAL_SYMBOLS);
    fullBlock.set(block, 0);

    const result = rsDecode(fullBlock);
    decoded.push(result.data);
    totalCorrected += result.symbolsCorrected;
  }

  // Concatenate decoded blocks and trim to original length
  const fullData = new Uint8Array(blockCount * RS_DATA_SYMBOLS);
  for (let i = 0; i < decoded.length; i++) {
    fullData.set(decoded[i], i * RS_DATA_SYMBOLS);
  }

  return {
    data: fullData.subarray(0, originalLength),
    totalCorrected,
  };
}

/* ═══════════════════════════════════════════
   LSB STEGANOGRAPHY — EMBED & EXTRACT
   ═══════════════════════════════════════════

   We hide data in the Least Significant Bit (LSB) of the BLUE channel
   of each pixel. Why blue?
     - Human vision is least sensitive to blue channel changes
     - The LSB change (±1 in 0-255) is imperceptible

   Each byte of hidden data requires 8 pixels (1 bit per pixel LSB).

   The layout in the pixel data is:
     Bytes 0-3:  Payload length (big-endian uint32)
     Bytes 4-7:  Original data length before RS encoding (big-endian uint32)
     Bytes 8+:   RS-encoded payload
*/

const HEADER_BYTES = 8; // 4 bytes RS-encoded length + 4 bytes original length

/**
 * Analyze an image for steganographic capacity.
 *
 * @param imageData - ImageData from a canvas
 * @returns Capacity information
 */
export function analyzeCapacity(imageData: ImageData): StegoCapacity {
  const totalPixels = imageData.width * imageData.height;
  // 10% of pixels, divided by 8 (bits per byte), minus header overhead
  const rawCapacity = Math.floor((totalPixels * 0.1) / 8) - HEADER_BYTES;
  // Account for RS overhead: each 247 data bytes become 255 encoded bytes
  const maxPayloadBytes = Math.floor(
    (rawCapacity / RS_TOTAL_SYMBOLS) * RS_DATA_SYMBOLS
  );

  return {
    totalPixels,
    maxPayloadBytes: Math.max(0, maxPayloadBytes),
    width: imageData.width,
    height: imageData.height,
  };
}

/**
 * Validate that an image file is PNG format.
 *
 * We check the PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
 * JPEG and WebP are REJECTED because lossy compression destroys LSB data.
 *
 * @param fileBytes - First 8+ bytes of the image file
 * @returns true if valid PNG
 */
export function validatePNG(fileBytes: Uint8Array): boolean {
  const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (fileBytes.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (fileBytes[i] !== PNG_MAGIC[i]) return false;
  }
  return true;
}

/**
 * Write a single bit into a pixel's blue channel LSB.
 *
 * @param pixels - The ImageData pixel array (RGBA, 4 bytes per pixel)
 * @param pixelIndex - Which pixel to modify
 * @param bit - The bit to write (0 or 1)
 */
function writeBit(pixels: Uint8ClampedArray, pixelIndex: number, bit: number): void {
  // Each pixel is 4 bytes: R, G, B, A
  // Blue channel is at offset +2
  const byteIndex = pixelIndex * 4 + 2;
  if (bit === 1) {
    pixels[byteIndex] = pixels[byteIndex] | 1; // Set LSB to 1
  } else {
    pixels[byteIndex] = pixels[byteIndex] & 0xfe; // Set LSB to 0
  }
}

/**
 * Read a single bit from a pixel's blue channel LSB.
 */
function readBit(pixels: Uint8ClampedArray, pixelIndex: number): number {
  const byteIndex = pixelIndex * 4 + 2;
  return pixels[byteIndex] & 1;
}

/**
 * Convert a uint32 to 4 big-endian bytes.
 */
function uint32ToBytes(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  bytes[0] = (value >>> 24) & 0xff;
  bytes[1] = (value >>> 16) & 0xff;
  bytes[2] = (value >>> 8) & 0xff;
  bytes[3] = value & 0xff;
  return bytes;
}

/**
 * Convert 4 big-endian bytes to uint32.
 */
function bytesToUint32(bytes: Uint8Array): number {
  return (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
}

/**
 * Embed an encrypted payload into a PNG image using LSB steganography
 * with Reed-Solomon error correction.
 *
 * Flow:
 *   1. Validate payload fits within 10% capacity
 *   2. RS-encode the payload (adds error correction)
 *   3. Build header: [4 bytes RS length] [4 bytes original length]
 *   4. Write header + RS-encoded data bit-by-bit into blue channel LSBs
 *   5. Return modified ImageData
 *
 * @param options - Payload and cover image
 * @returns Modified ImageData with hidden payload
 * @throws If payload exceeds capacity or image is too small
 */
export function embedInImage(options: EmbedOptions): ImageData {
  const { payload, imageData } = options;
  const capacity = analyzeCapacity(imageData);

  if (payload.length > capacity.maxPayloadBytes) {
    throw new Error(
      `Payload (${payload.length} bytes) exceeds maximum capacity ` +
        `(${capacity.maxPayloadBytes} bytes). Use a larger image or smaller payload.`
    );
  }

  if (payload.length === 0) {
    throw new Error('Empty payload');
  }

  // Step 2: RS-encode the payload
  const rsEncoded = rsEncodeAll(payload);

  // Step 3: Build header
  const rsLengthHeader = uint32ToBytes(rsEncoded.length);
  const origLengthHeader = uint32ToBytes(payload.length);

  // Combine: header + RS-encoded data
  const fullPayload = new Uint8Array(
    HEADER_BYTES + rsEncoded.length
  );
  fullPayload.set(rsLengthHeader, 0);
  fullPayload.set(origLengthHeader, 4);
  fullPayload.set(rsEncoded, HEADER_BYTES);

  // Step 4: Check we have enough pixels (each byte needs 8 pixels)
  const pixelsNeeded = fullPayload.length * 8;
  if (pixelsNeeded > capacity.totalPixels) {
    throw new Error(
      `Need ${pixelsNeeded} pixels but image only has ${capacity.totalPixels}`
    );
  }

  // Create a copy of the image data to avoid mutating the original
  const output = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );

  // Step 5: Write bits into LSBs
  let pixelIdx = 0;
  for (let byteIdx = 0; byteIdx < fullPayload.length; byteIdx++) {
    const byte = fullPayload[byteIdx];
    // Write each bit from MSB to LSB
    for (let bitIdx = 7; bitIdx >= 0; bitIdx--) {
      const bit = (byte >>> bitIdx) & 1;
      writeBit(output.data, pixelIdx, bit);
      pixelIdx++;
    }
  }

  return output;
}

/**
 * Extract a hidden payload from a PNG image with LSB steganography.
 *
 * Flow:
 *   1. Read header (8 bytes = 64 pixels) to get RS length and original length
 *   2. Read RS-encoded data from subsequent pixels
 *   3. RS-decode with error correction
 *   4. Return the original payload
 *
 * @param imageData - The stego image's ImageData
 * @returns Extracted payload with correction statistics
 * @throws If no valid data found or uncorrectable errors
 */
export function extractFromImage(imageData: ImageData): ExtractResult {
  const totalPixels = imageData.width * imageData.height;

  // Helper: read N bytes starting from a pixel offset
  function readBytes(startPixel: number, count: number): Uint8Array {
    const bytes = new Uint8Array(count);
    let pixelIdx = startPixel;
    for (let byteIdx = 0; byteIdx < count; byteIdx++) {
      let byte = 0;
      for (let bitIdx = 7; bitIdx >= 0; bitIdx--) {
        const bit = readBit(imageData.data, pixelIdx);
        byte |= bit << bitIdx;
        pixelIdx++;
      }
      bytes[byteIdx] = byte;
    }
    return bytes;
  }

  // Step 1: Read header
  const header = readBytes(0, HEADER_BYTES);
  const rsLength = bytesToUint32(header.subarray(0, 4));
  const originalLength = bytesToUint32(header.subarray(4, 8));

  // Sanity checks
  if (rsLength === 0 || originalLength === 0) {
    throw new Error('No steganographic data found in image');
  }
  if (rsLength > totalPixels / 8) {
    throw new Error('Corrupted header: RS length exceeds image capacity');
  }
  if (originalLength > rsLength) {
    throw new Error('Corrupted header: original length exceeds RS length');
  }

  // Step 2: Read RS-encoded data
  const rsData = readBytes(HEADER_BYTES * 8, rsLength);

  // Step 3: RS-decode
  const { data, totalCorrected } = rsDecodeAll(rsData, originalLength);

  return {
    payload: data,
    correctionApplied: totalCorrected > 0,
    symbolsCorrected: totalCorrected,
  };
}

/* ═══════════════════════════════════════════
   HIGH-LEVEL API — FILE HANDLING
   ═══════════════════════════════════════════ */

/**
 * Load a PNG file into ImageData via an offscreen canvas.
 * Rejects non-PNG files.
 *
 * @param file - File or Blob containing PNG image data
 * @returns ImageData pixels
 * @throws If file is not a valid PNG
 */
export async function loadPNGToImageData(file: File | Blob): Promise<ImageData> {
  // Read file header to validate PNG magic
  const headerSlice = file.slice(0, 8);
  const headerBytes = new Uint8Array(await headerSlice.arrayBuffer());

  if (!validatePNG(headerBytes)) {
    throw new Error(
      'Only PNG images are supported for steganography. ' +
        'JPEG and WebP use lossy compression that destroys hidden data.'
    );
  }

  // Load image via createImageBitmap (works in Web Workers too)
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');

  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

/**
 * Export modified ImageData back to a PNG Blob.
 *
 * @param imageData - The stego ImageData
 * @returns PNG Blob ready for download
 */
export async function imageDataToPNG(imageData: ImageData): Promise<Blob> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');

  ctx.putImageData(imageData, 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}
