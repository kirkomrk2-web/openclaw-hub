/**
 * Steganography panel component.
 *
 * Allows users to embed encrypted messages into PNG images and extract
 * hidden messages from stego images. Only PNG format is accepted.
 */

import { useState, useRef, type ChangeEvent } from 'react';
import {
  analyzeCapacity,
  loadPNGToImageData,
  embedInImage,
  extractFromImage,
  imageDataToPNG,
  type StegoCapacity,
} from '../crypto/steganography';

export interface StegoPanelProps {
  /** Callback when a message is extracted from an image */
  onMessageExtracted: (payload: Uint8Array) => void;
  /** Encrypted payload to embed (from the chat engine) */
  payloadToEmbed: Uint8Array | null;
}

export function StegoPanel({ onMessageExtracted, payloadToEmbed }: StegoPanelProps) {
  const [mode, setMode] = useState<'embed' | 'extract'>('embed');
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [capacity, setCapacity] = useState<StegoCapacity | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setStatus(null);

    try {
      const data = await loadPNGToImageData(file);
      setImageData(data);

      const cap = analyzeCapacity(data);
      setCapacity(cap);

      // Create preview URL
      const url = URL.createObjectURL(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);

      setStatus(
        `Image loaded: ${cap.width}x${cap.height}, ` +
          `capacity: ${cap.maxPayloadBytes} bytes`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image');
      setImageData(null);
      setCapacity(null);
    }
  };

  const handleEmbed = async () => {
    if (!imageData || !payloadToEmbed) return;

    setIsProcessing(true);
    setError(null);

    try {
      const stegoImageData = embedInImage({
        payload: payloadToEmbed,
        imageData,
      });

      const blob = await imageDataToPNG(stegoImageData);
      const url = URL.createObjectURL(blob);

      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `phantom-stego-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus('Message embedded successfully. Download started.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Embedding failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtract = async () => {
    if (!imageData) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = extractFromImage(imageData);

      if (result.correctionApplied) {
        setStatus(
          `Message extracted with ${result.symbolsCorrected} error corrections applied.`
        );
      } else {
        setStatus('Message extracted successfully. No errors detected.');
      }

      onMessageExtracted(result.payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6">
      <h3 className="text-zinc-100 font-medium mb-4">Steganography</h3>

      {/* Mode Tabs */}
      <div className="flex mb-4 bg-zinc-900 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setMode('embed')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === 'embed'
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Embed Message
        </button>
        <button
          type="button"
          onClick={() => setMode('extract')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === 'extract'
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Extract Message
        </button>
      </div>

      {/* File Input */}
      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border border-dashed border-zinc-800 rounded-lg p-4 text-zinc-500 text-sm hover:border-zinc-600 hover:text-zinc-400 transition-colors"
        >
          {previewUrl ? 'Change image' : 'Select PNG image (PNG only)'}
        </button>
      </div>

      {/* Image Preview */}
      {previewUrl && (
        <div className="mb-4 rounded-lg overflow-hidden border border-zinc-900">
          <img
            src={previewUrl}
            alt="Cover image preview"
            className="w-full h-32 object-cover"
          />
        </div>
      )}

      {/* Capacity Info */}
      {capacity && (
        <div className="mb-4 text-xs text-zinc-500 space-y-1">
          <p>
            Dimensions: {capacity.width} x {capacity.height} ({capacity.totalPixels.toLocaleString()} pixels)
          </p>
          <p>
            Max payload: {capacity.maxPayloadBytes.toLocaleString()} bytes
          </p>
          {payloadToEmbed && (
            <p
              className={
                payloadToEmbed.length <= capacity.maxPayloadBytes
                  ? 'text-emerald-500'
                  : 'text-red-500'
              }
            >
              Payload size: {payloadToEmbed.length.toLocaleString()} bytes
              {payloadToEmbed.length <= capacity.maxPayloadBytes ? ' (fits)' : ' (too large!)'}
            </p>
          )}
        </div>
      )}

      {/* Action Button */}
      {mode === 'embed' ? (
        <button
          type="button"
          onClick={handleEmbed}
          disabled={!imageData || !payloadToEmbed || isProcessing}
          className="w-full bg-zinc-100 text-zinc-900 font-medium py-2 rounded-lg text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Embedding...' : 'Embed & Download'}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleExtract}
          disabled={!imageData || isProcessing}
          className="w-full bg-zinc-100 text-zinc-900 font-medium py-2 rounded-lg text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Extracting...' : 'Extract Message'}
        </button>
      )}

      {/* Status / Error */}
      {status && (
        <p className="mt-3 text-xs text-emerald-500">{status}</p>
      )}
      {error && (
        <p className="mt-3 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
