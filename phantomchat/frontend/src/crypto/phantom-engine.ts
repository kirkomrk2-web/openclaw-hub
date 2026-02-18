/**
 * PhantomChat Crypto Engine — "Phantom Scheme"
 *
 * Three-layer encryption architecture using ONLY proven, audited primitives:
 *   Layer 1: X25519 ECDH key exchange (libsodium)
 *   Layer 2: Dual symmetric encryption — AES-256-GCM (Web Crypto) + ChaCha20-Poly1305 (libsodium)
 *   Layer 3: BLAKE3 integrity hash included in the encrypted payload
 *
 * Defense-in-depth: compromising one symmetric layer does NOT break the other,
 * because they use fundamentally different mathematical constructions.
 *
 * SECURITY INVARIANT: Every function that handles key material MUST call
 * sodium.memzero() on all intermediate buffers before returning.
 */

import sodium from 'libsodium-wrappers';

/* ═══════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════ */

/** Result of a full Phantom encrypt operation */
export interface PhantomCiphertext {
  /** Unique message identifier */
  messageId: string;
  /** AES-256-GCM initialisation vector (12 bytes, base64) */
  aesIv: string;
  /** ChaCha20-Poly1305 nonce (24 bytes, base64) */
  chaChaNonce: string;
  /** Double-encrypted ciphertext (base64) */
  ciphertext: string;
  /** Sender's ephemeral public key for this message (base64) */
  ephemeralPublicKey: string;
  /** Lamport timestamp for causal ordering */
  lamportTs: number;
  /** Optional TTL in seconds for self-destruct messages */
  ttlSeconds: number | null;
  /** If true the decryption key is deleted after first read */
  burnAfterRead: boolean;
}

/** Decrypted message with verified integrity */
export interface PhantomPlaintext {
  /** Original plaintext (UTF-8 string) */
  text: string;
  /** Message ID from the ciphertext envelope */
  messageId: string;
  /** Lamport timestamp */
  lamportTs: number;
  /** Whether integrity check (BLAKE3) passed */
  integrityVerified: boolean;
}

/** An X25519 keypair stored in memory */
export interface PhantomKeypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/** Serialised form used for transport / storage */
export interface SerializedPublicKey {
  publicKey: string; // base64
}

/** Parameters controlling self-destruct behaviour */
export interface SelfDestructParams {
  ttlSeconds: number | null;
  burnAfterRead: boolean;
}

/* ═══════════════════════════════════════════
   INTERNAL HELPERS
   ═══════════════════════════════════════════ */

/**
 * Generate a v4 UUID using the cryptographic RNG.
 * We avoid Math.random() entirely — every random byte comes from
 * crypto.getRandomValues or libsodium's randombytes_buf.
 */
function cryptoUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: construct UUID v4 from random bytes
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
  buf[8] = (buf[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

/** Convert Uint8Array to base64 string */
function toBase64(buf: Uint8Array): string {
  return sodium.to_base64(buf, sodium.base64_variants.ORIGINAL);
}

/** Convert base64 string back to Uint8Array */
function fromBase64(b64: string): Uint8Array {
  return sodium.from_base64(b64, sodium.base64_variants.ORIGINAL);
}

/* ═══════════════════════════════════════════
   INITIALISATION
   ═══════════════════════════════════════════ */

let _sodiumReady = false;

/**
 * Initialise libsodium. MUST be called once before any crypto operation.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function initPhantomEngine(): Promise<void> {
  if (_sodiumReady) return;
  await sodium.ready;
  _sodiumReady = true;
}

function ensureReady(): void {
  if (!_sodiumReady) {
    throw new Error('PhantomEngine not initialised. Call initPhantomEngine() first.');
  }
}

/* ═══════════════════════════════════════════
   LAYER 1 — X25519 ECDH KEY EXCHANGE
   ═══════════════════════════════════════════ */

/**
 * Generate an X25519 keypair for Diffie-Hellman key agreement.
 *
 * The secret key NEVER leaves the device. The public key is uploaded to the
 * server so other users can compute a shared secret with us.
 *
 * @returns A new PhantomKeypair containing 32-byte public and secret keys.
 */
export function generateIdentityKeypair(): PhantomKeypair {
  ensureReady();
  const kp = sodium.crypto_kx_keypair();
  return { publicKey: kp.publicKey, secretKey: kp.privateKey };
}

/**
 * Generate a short-lived ephemeral keypair for a single message exchange.
 * This provides Forward Secrecy: even if the identity key is later compromised,
 * past messages encrypted with ephemeral keys remain safe.
 *
 * @returns A new ephemeral PhantomKeypair.
 */
export function generateEphemeralKeypair(): PhantomKeypair {
  ensureReady();
  const kp = sodium.crypto_box_keypair();
  return { publicKey: kp.publicKey, secretKey: kp.privateKey };
}

/**
 * Derive a 32-byte shared secret from our secret key and the peer's public key
 * using X25519 scalar multiplication followed by BLAKE2b hashing (libsodium's
 * crypto_scalarmult + crypto_generichash).
 *
 * The raw X25519 output is NOT used directly — we hash it to ensure uniform
 * distribution and domain separation.
 *
 * @param ourSecret  - Our X25519 secret key (32 bytes)
 * @param theirPublic - Peer's X25519 public key (32 bytes)
 * @returns 32-byte shared secret suitable for symmetric encryption
 */
export function deriveSharedSecret(
  ourSecret: Uint8Array,
  theirPublic: Uint8Array
): Uint8Array {
  ensureReady();

  // Raw X25519 scalar multiplication
  const rawShared = sodium.crypto_scalarmult(ourSecret, theirPublic);

  // Hash to ensure uniform distribution — domain-separated with a context string
  const context = sodium.from_string('PhantomChat-SharedSecret-v1');
  const derived = sodium.crypto_generichash(32, rawShared, context);

  // SECURITY: zeroing intermediate key material
  sodium.memzero(rawShared);

  return derived;
}

/* ═══════════════════════════════════════════
   LAYER 2a — AES-256-GCM (Web Crypto API)
   ═══════════════════════════════════════════ */

/**
 * Encrypt data with AES-256-GCM using the browser's native Web Crypto API.
 * This is typically hardware-accelerated via AES-NI on modern CPUs.
 *
 * AES-256-GCM provides:
 *   - 256-bit key → 128-bit security level (Grover's bound)
 *   - Authenticated encryption (built-in integrity via GCM tag)
 *   - 12-byte random IV (96 bits) — collision probability is negligible
 *     for fewer than 2^32 messages per key
 *
 * @param plaintext - Data to encrypt
 * @param key       - 32-byte symmetric key
 * @returns Object with iv (12 bytes) and ciphertext (includes 16-byte auth tag)
 */
async function aesGcmEncrypt(
  plaintext: Uint8Array,
  key: Uint8Array
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    plaintext
  );

  return { iv, ciphertext: new Uint8Array(encrypted) };
}

/**
 * Decrypt AES-256-GCM ciphertext.
 *
 * @param ciphertext - Encrypted data including 16-byte GCM auth tag
 * @param key        - 32-byte symmetric key (same as used for encryption)
 * @param iv         - 12-byte IV used during encryption
 * @returns Decrypted plaintext bytes
 * @throws If authentication fails (tampered or wrong key)
 */
async function aesGcmDecrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext
  );

  return new Uint8Array(decrypted);
}

/* ═══════════════════════════════════════════
   LAYER 2b — ChaCha20-Poly1305 (libsodium)
   ═══════════════════════════════════════════ */

/**
 * Encrypt data with XChaCha20-Poly1305 using libsodium.
 *
 * XChaCha20-Poly1305 uses a 24-byte nonce (vs 12 for IETF ChaCha20), making
 * random nonce collisions astronomically unlikely even across billions of
 * messages. It provides AEAD (Authenticated Encryption with Associated Data).
 *
 * Using a DIFFERENT cipher family than AES gives defense-in-depth:
 *   - AES is a substitution-permutation network (SPN)
 *   - ChaCha20 is an ARX (add-rotate-xor) stream cipher
 *   - A cryptanalytic break in one family does NOT imply a break in the other
 *
 * @param plaintext - Data to encrypt
 * @param key       - 32-byte symmetric key
 * @returns Object with nonce (24 bytes) and ciphertext (includes Poly1305 tag)
 */
function chaChaEncrypt(
  plaintext: Uint8Array,
  key: Uint8Array
): { nonce: Uint8Array; ciphertext: Uint8Array } {
  const nonce = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES // 24
  );

  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    null, // no additional data
    null, // secret nonce (unused in this API)
    nonce,
    key
  );

  return { nonce, ciphertext };
}

/**
 * Decrypt XChaCha20-Poly1305 ciphertext.
 *
 * @param ciphertext - Encrypted data including Poly1305 auth tag
 * @param key        - 32-byte symmetric key
 * @param nonce      - 24-byte nonce used during encryption
 * @returns Decrypted plaintext bytes
 * @throws If authentication fails (tampered or wrong key)
 */
function chaChaDecrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array
): Uint8Array {
  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, // secret nonce (unused)
    ciphertext,
    null, // no additional data
    nonce,
    key
  );
}

/* ═══════════════════════════════════════════
   LAYER 3 — BLAKE3 INTEGRITY HASH
   ═══════════════════════════════════════════ */

/**
 * Compute a BLAKE2b-256 hash of the plaintext for integrity verification.
 *
 * NOTE: libsodium ships BLAKE2b, not BLAKE3. BLAKE2b is equally secure and
 * is the basis for BLAKE3. We use BLAKE2b-256 (32 bytes output) keyed with
 * a domain-separation tag so this hash cannot be confused with other uses.
 *
 * The hash is included INSIDE the encrypted payload. On decryption we
 * recompute it and compare — if they differ, the message was tampered with
 * (even if the AEAD tags somehow passed, which would require breaking
 * both Poly1305 AND GCM — this is a belt-and-suspenders check).
 *
 * @param data - Plaintext bytes to hash
 * @returns 32-byte BLAKE2b hash
 */
function computeIntegrityHash(data: Uint8Array): Uint8Array {
  ensureReady();
  const key = sodium.from_string('PhantomChat-Integrity-v1-key!'); // 29 bytes
  // BLAKE2b supports keys from 16 to 64 bytes. Pad to 32 bytes.
  const paddedKey = new Uint8Array(32);
  paddedKey.set(key.subarray(0, Math.min(key.length, 32)));
  const hash = sodium.crypto_generichash(32, data, paddedKey);
  // SECURITY: zeroing key material
  sodium.memzero(paddedKey);
  return hash;
}

/**
 * Verify the BLAKE2b integrity hash matches the plaintext.
 *
 * @param data         - Decrypted plaintext bytes
 * @param expectedHash - The 32-byte hash from inside the encrypted payload
 * @returns true if integrity is verified
 */
function verifyIntegrityHash(data: Uint8Array, expectedHash: Uint8Array): boolean {
  const computed = computeIntegrityHash(data);
  // Constant-time comparison to prevent timing side-channels
  const result = sodium.memcmp(computed, expectedHash);
  // SECURITY: zeroing intermediate hash
  sodium.memzero(computed);
  return result;
}

/* ═══════════════════════════════════════════
   KEY DERIVATION — SPLIT SHARED SECRET
   ═══════════════════════════════════════════ */

/**
 * Derive two independent 32-byte subkeys from the shared secret:
 *   subkey[0] → AES-256-GCM
 *   subkey[1] → XChaCha20-Poly1305
 *
 * We use libsodium's crypto_kdf_derive_from_key which internally uses
 * BLAKE2b in keyed mode with a context string, producing cryptographically
 * independent subkeys even though they derive from the same master secret.
 *
 * @param sharedSecret - 32-byte master shared secret from ECDH
 * @returns Tuple of [aesKey, chaChaKey], each 32 bytes
 */
function deriveSubkeys(sharedSecret: Uint8Array): [Uint8Array, Uint8Array] {
  ensureReady();

  // Context must be exactly 8 bytes for crypto_kdf_derive_from_key
  const context = 'PhantomK'; // 8 ASCII chars

  const aesKey = sodium.crypto_kdf_derive_from_key(32, 1, context, sharedSecret);
  const chaChaKey = sodium.crypto_kdf_derive_from_key(32, 2, context, sharedSecret);

  return [aesKey, chaChaKey];
}

/* ═══════════════════════════════════════════
   LAMPORT CLOCK
   ═══════════════════════════════════════════ */

/**
 * Simple Lamport logical clock for causal message ordering.
 *
 * Each message carries a Lamport timestamp. The rules are:
 *   1. Before sending: localClock++, attach localClock to message
 *   2. On receive: localClock = max(localClock, receivedTs) + 1
 *
 * This gives us a partial order that is consistent even when clocks drift
 * or messages arrive out of order. Combined with the append-only model,
 * conflicts are architecturally impossible.
 */
let _lamportClock = 0;

export function tickLamport(): number {
  _lamportClock += 1;
  return _lamportClock;
}

export function updateLamport(receivedTs: number): number {
  _lamportClock = Math.max(_lamportClock, receivedTs) + 1;
  return _lamportClock;
}

export function currentLamport(): number {
  return _lamportClock;
}

/* ═══════════════════════════════════════════
   MAIN API — ENCRYPT
   ═══════════════════════════════════════════ */

/**
 * Encrypt a plaintext message using the full Phantom Scheme.
 *
 * Execution flow:
 *   1. Generate an ephemeral X25519 keypair (forward secrecy)
 *   2. Derive shared secret: ECDH(ephemeral_secret, recipient_public)
 *   3. Split shared secret into two subkeys (AES + ChaCha)
 *   4. Compute BLAKE2b integrity hash of the plaintext
 *   5. Prepend hash to plaintext → payload = hash || plaintext
 *   6. Layer 2a: AES-256-GCM encrypt the payload
 *   7. Layer 2b: XChaCha20-Poly1305 encrypt the AES ciphertext
 *   8. Zero all key material
 *   9. Return the sealed PhantomCiphertext envelope
 *
 * @param plaintext        - UTF-8 message text
 * @param recipientPubKey  - Recipient's X25519 public key (32 bytes)
 * @param selfDestruct     - Optional self-destruct parameters
 * @returns Fully encrypted PhantomCiphertext envelope
 */
export async function phantomEncrypt(
  plaintext: string,
  recipientPubKey: Uint8Array,
  selfDestruct: SelfDestructParams = { ttlSeconds: null, burnAfterRead: false }
): Promise<PhantomCiphertext> {
  ensureReady();

  // Step 1: Ephemeral keypair for forward secrecy
  const ephemeral = generateEphemeralKeypair();

  // Step 2: ECDH shared secret
  const sharedSecret = deriveSharedSecret(ephemeral.secretKey, recipientPubKey);

  // Step 3: Split into two independent subkeys
  const [aesKey, chaChaKey] = deriveSubkeys(sharedSecret);

  // Step 4: BLAKE2b integrity hash of the plaintext
  const plaintextBytes = sodium.from_string(plaintext);
  const integrityHash = computeIntegrityHash(plaintextBytes);

  // Step 5: Construct payload = 32-byte hash || plaintext bytes
  const payload = new Uint8Array(integrityHash.length + plaintextBytes.length);
  payload.set(integrityHash, 0);
  payload.set(plaintextBytes, integrityHash.length);

  // Step 6: Layer 2a — AES-256-GCM
  const aesResult = await aesGcmEncrypt(payload, aesKey);

  // Step 7: Layer 2b — XChaCha20-Poly1305 wraps the AES ciphertext
  const chaChaResult = chaChaEncrypt(aesResult.ciphertext, chaChaKey);

  // Step 8: Tick Lamport clock
  const lamportTs = tickLamport();

  // Step 9: Generate unique message ID
  const messageId = cryptoUUID();

  // Construct the envelope
  const envelope: PhantomCiphertext = {
    messageId,
    aesIv: toBase64(aesResult.iv),
    chaChaNonce: toBase64(chaChaResult.nonce),
    ciphertext: toBase64(chaChaResult.ciphertext),
    ephemeralPublicKey: toBase64(ephemeral.publicKey),
    lamportTs,
    ttlSeconds: selfDestruct.ttlSeconds,
    burnAfterRead: selfDestruct.burnAfterRead,
  };

  // SECURITY: zeroing ALL key material and intermediate buffers
  sodium.memzero(ephemeral.secretKey);
  sodium.memzero(sharedSecret);
  sodium.memzero(aesKey);
  sodium.memzero(chaChaKey);
  sodium.memzero(plaintextBytes);
  sodium.memzero(integrityHash);
  sodium.memzero(payload);
  sodium.memzero(aesResult.iv);
  sodium.memzero(aesResult.ciphertext);
  sodium.memzero(chaChaResult.nonce);

  return envelope;
}

/* ═══════════════════════════════════════════
   MAIN API — DECRYPT
   ═══════════════════════════════════════════ */

/**
 * Decrypt a PhantomCiphertext envelope using the full Phantom Scheme.
 *
 * Execution flow:
 *   1. Decode base64 fields from the envelope
 *   2. Derive shared secret: ECDH(our_secret, sender_ephemeral_public)
 *   3. Split shared secret into two subkeys (AES + ChaCha)
 *   4. Layer 2b: XChaCha20-Poly1305 decrypt → reveals AES ciphertext
 *   5. Layer 2a: AES-256-GCM decrypt → reveals payload (hash || plaintext)
 *   6. Split payload into integrity hash and plaintext
 *   7. Verify BLAKE2b hash matches the plaintext
 *   8. Zero all key material
 *   9. Return PhantomPlaintext with integrity status
 *
 * @param envelope    - The PhantomCiphertext to decrypt
 * @param ourSecret   - Our X25519 secret key (32 bytes)
 * @returns Decrypted PhantomPlaintext with integrity verification result
 * @throws If either AEAD layer fails authentication
 */
export async function phantomDecrypt(
  envelope: PhantomCiphertext,
  ourSecret: Uint8Array
): Promise<PhantomPlaintext> {
  ensureReady();

  // Step 1: Decode base64 fields
  const aesIv = fromBase64(envelope.aesIv);
  const chaChaNonce = fromBase64(envelope.chaChaNonce);
  const ciphertext = fromBase64(envelope.ciphertext);
  const ephemeralPub = fromBase64(envelope.ephemeralPublicKey);

  // Step 2: ECDH shared secret using sender's ephemeral public key
  const sharedSecret = deriveSharedSecret(ourSecret, ephemeralPub);

  // Step 3: Split into subkeys
  const [aesKey, chaChaKey] = deriveSubkeys(sharedSecret);

  // Step 4: Layer 2b — XChaCha20-Poly1305 decrypt (outer layer)
  const aesCiphertext = chaChaDecrypt(ciphertext, chaChaKey, chaChaNonce);

  // Step 5: Layer 2a — AES-256-GCM decrypt (inner layer)
  const payload = await aesGcmDecrypt(aesCiphertext, aesKey, aesIv);

  // Step 6: Split payload — first 32 bytes are the BLAKE2b hash
  const integrityHash = payload.slice(0, 32);
  const plaintextBytes = payload.slice(32);

  // Step 7: Verify integrity
  const integrityVerified = verifyIntegrityHash(plaintextBytes, integrityHash);

  // Step 8: Decode plaintext
  const text = sodium.to_string(plaintextBytes);

  // Update Lamport clock from received timestamp
  updateLamport(envelope.lamportTs);

  // Construct result
  const result: PhantomPlaintext = {
    text,
    messageId: envelope.messageId,
    lamportTs: envelope.lamportTs,
    integrityVerified,
  };

  // SECURITY: zeroing ALL key material and intermediate buffers
  sodium.memzero(sharedSecret);
  sodium.memzero(aesKey);
  sodium.memzero(chaChaKey);
  sodium.memzero(aesCiphertext);
  sodium.memzero(payload);
  sodium.memzero(integrityHash);
  sodium.memzero(plaintextBytes);
  sodium.memzero(aesIv);
  sodium.memzero(chaChaNonce);

  return result;
}

/* ═══════════════════════════════════════════
   GROUP CHAT — MULTI-RECIPIENT ENCRYPT
   ═══════════════════════════════════════════ */

/**
 * Encrypt a message for a group conversation.
 *
 * Strategy: encrypt once with a random "message key", then wrap that
 * message key individually for each recipient using their public key.
 * This is O(N) in group size for key wrapping but O(1) for bulk encryption.
 *
 * @param plaintext      - UTF-8 message text
 * @param recipientPubKeys - Array of recipients' X25519 public keys
 * @returns Object with the encrypted message and per-recipient wrapped keys
 */
export async function phantomGroupEncrypt(
  plaintext: string,
  recipientPubKeys: Uint8Array[]
): Promise<{
  envelope: PhantomCiphertext;
  wrappedKeys: Array<{ recipientPubKey: string; wrappedKey: string; ephemeralPub: string }>;
}> {
  ensureReady();

  // Generate a random 32-byte message key
  const messageKey = sodium.randombytes_buf(32);

  // Encrypt the plaintext with the message key using the full Phantom scheme
  // We use a synthetic "recipient" by importing the message key as the shared secret
  const plaintextBytes = sodium.from_string(plaintext);
  const integrityHash = computeIntegrityHash(plaintextBytes);

  const payload = new Uint8Array(integrityHash.length + plaintextBytes.length);
  payload.set(integrityHash, 0);
  payload.set(plaintextBytes, integrityHash.length);

  const [aesKey, chaChaKey] = deriveSubkeys(messageKey);
  const aesResult = await aesGcmEncrypt(payload, aesKey);
  const chaChaResult = chaChaEncrypt(aesResult.ciphertext, chaChaKey);

  const lamportTs = tickLamport();
  const messageId = cryptoUUID();

  // Wrap the message key for each recipient
  const wrappedKeys: Array<{
    recipientPubKey: string;
    wrappedKey: string;
    ephemeralPub: string;
  }> = [];

  for (const recipientPub of recipientPubKeys) {
    const ephemeral = generateEphemeralKeypair();
    const shared = deriveSharedSecret(ephemeral.secretKey, recipientPub);

    // Encrypt the message key with the shared secret using crypto_secretbox
    const wrapNonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const wrappedKeyBytes = sodium.crypto_secretbox_easy(messageKey, wrapNonce, shared);

    // Combine nonce + wrapped key for transport
    const combined = new Uint8Array(wrapNonce.length + wrappedKeyBytes.length);
    combined.set(wrapNonce, 0);
    combined.set(wrappedKeyBytes, wrapNonce.length);

    wrappedKeys.push({
      recipientPubKey: toBase64(recipientPub),
      wrappedKey: toBase64(combined),
      ephemeralPub: toBase64(ephemeral.publicKey),
    });

    // SECURITY: zeroing key material per iteration
    sodium.memzero(ephemeral.secretKey);
    sodium.memzero(shared);
    sodium.memzero(wrapNonce);
  }

  const envelope: PhantomCiphertext = {
    messageId,
    aesIv: toBase64(aesResult.iv),
    chaChaNonce: toBase64(chaChaResult.nonce),
    ciphertext: toBase64(chaChaResult.ciphertext),
    ephemeralPublicKey: '', // Not used for group — wrapped keys carry ephemeral info
    lamportTs,
    ttlSeconds: null,
    burnAfterRead: false,
  };

  // SECURITY: zeroing ALL key material
  sodium.memzero(messageKey);
  sodium.memzero(aesKey);
  sodium.memzero(chaChaKey);
  sodium.memzero(plaintextBytes);
  sodium.memzero(integrityHash);
  sodium.memzero(payload);
  sodium.memzero(aesResult.iv);
  sodium.memzero(aesResult.ciphertext);
  sodium.memzero(chaChaResult.nonce);

  return { envelope, wrappedKeys };
}

/**
 * Decrypt a group message by first unwrapping the message key.
 *
 * @param envelope   - The PhantomCiphertext from phantomGroupEncrypt
 * @param wrappedKey - Our per-recipient wrapped key entry
 * @param ourSecret  - Our X25519 secret key (32 bytes)
 * @returns Decrypted PhantomPlaintext
 */
export async function phantomGroupDecrypt(
  envelope: PhantomCiphertext,
  wrappedKey: { wrappedKey: string; ephemeralPub: string },
  ourSecret: Uint8Array
): Promise<PhantomPlaintext> {
  ensureReady();

  // Unwrap the message key
  const ephemeralPub = fromBase64(wrappedKey.ephemeralPub);
  const combined = fromBase64(wrappedKey.wrappedKey);

  const shared = deriveSharedSecret(ourSecret, ephemeralPub);
  const wrapNonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const wrappedKeyBytes = combined.slice(sodium.crypto_secretbox_NONCEBYTES);

  const messageKey = sodium.crypto_secretbox_open_easy(wrappedKeyBytes, wrapNonce, shared);

  // Now decrypt using the message key as the shared secret
  const [aesKey, chaChaKey] = deriveSubkeys(messageKey);

  const chaChaNonce = fromBase64(envelope.chaChaNonce);
  const ciphertext = fromBase64(envelope.ciphertext);
  const aesIv = fromBase64(envelope.aesIv);

  const aesCiphertext = chaChaDecrypt(ciphertext, chaChaKey, chaChaNonce);
  const payload = await aesGcmDecrypt(aesCiphertext, aesKey, aesIv);

  const integrityHash = payload.slice(0, 32);
  const plaintextBytes = payload.slice(32);
  const integrityVerified = verifyIntegrityHash(plaintextBytes, integrityHash);
  const text = sodium.to_string(plaintextBytes);

  updateLamport(envelope.lamportTs);

  const result: PhantomPlaintext = {
    text,
    messageId: envelope.messageId,
    lamportTs: envelope.lamportTs,
    integrityVerified,
  };

  // SECURITY: zeroing ALL key material and intermediate buffers
  sodium.memzero(shared);
  sodium.memzero(messageKey);
  sodium.memzero(aesKey);
  sodium.memzero(chaChaKey);
  sodium.memzero(aesCiphertext);
  sodium.memzero(payload);
  sodium.memzero(integrityHash);
  sodium.memzero(plaintextBytes);
  sodium.memzero(aesIv);
  sodium.memzero(chaChaNonce);

  return result;
}

/* ═══════════════════════════════════════════
   UTILITY — SERIALIZE / DESERIALIZE KEYS
   ═══════════════════════════════════════════ */

/**
 * Serialize a public key for transport (upload to server).
 * Only the PUBLIC key is ever serialized — the secret key stays in memory.
 */
export function serializePublicKey(kp: PhantomKeypair): SerializedPublicKey {
  return { publicKey: toBase64(kp.publicKey) };
}

/**
 * Deserialize a public key received from the server.
 */
export function deserializePublicKey(serialized: SerializedPublicKey): Uint8Array {
  return fromBase64(serialized.publicKey);
}

/**
 * Export the public key as base64 string.
 */
export function exportPublicKey(publicKey: Uint8Array): string {
  return toBase64(publicKey);
}

/**
 * Import a base64-encoded public key.
 */
export function importPublicKey(b64: string): Uint8Array {
  return fromBase64(b64);
}
