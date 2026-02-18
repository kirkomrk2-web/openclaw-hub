/**
 * PhantomChat Key Manager — Ephemeral Key Lifecycle
 *
 * Manages identity keys, ephemeral session keys, and key rotation.
 * Implements Forward Secrecy by generating a new ephemeral keypair for
 * every message exchange session.
 *
 * KEY STORAGE STRATEGY:
 *   - Identity keypair: stored in IndexedDB (encrypted at rest via Argon2-derived key)
 *   - Ephemeral keypairs: held in memory ONLY — never persisted to disk
 *   - Public keys: sent to server for peer discovery
 *   - Secret keys: NEVER leave the device, NEVER sent over the network
 *
 * SECURITY: All secret key material is zeroed after use via sodium.memzero().
 */

import sodium from 'libsodium-wrappers';
import {
  type PhantomKeypair,
  generateIdentityKeypair,
  generateEphemeralKeypair,
  exportPublicKey,
  importPublicKey,
  initPhantomEngine,
} from './phantom-engine';

/* ═══════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════ */

/** Encrypted identity key blob for IndexedDB storage */
export interface EncryptedIdentityKey {
  /** XChaCha20-Poly1305 nonce (base64) */
  nonce: string;
  /** Encrypted secret key (base64) */
  ciphertext: string;
  /** Public key in the clear (base64) — not secret */
  publicKey: string;
}

/** An ephemeral session with a specific peer */
export interface EphemeralSession {
  /** Session identifier */
  sessionId: string;
  /** Our ephemeral keypair for this session */
  keypair: PhantomKeypair;
  /** Peer's public key (identity or ephemeral) */
  peerPublicKey: Uint8Array;
  /** Creation timestamp (for expiry enforcement) */
  createdAt: number;
  /** Number of messages encrypted with this session key */
  messageCount: number;
}

/** Limits for key rotation policy */
export interface RotationPolicy {
  /** Maximum number of messages before rotating session key */
  maxMessages: number;
  /** Maximum age in milliseconds before rotating session key */
  maxAgeMs: number;
}

/** Events emitted by the key manager */
export type KeyManagerEvent =
  | { type: 'identity-created'; publicKey: string }
  | { type: 'session-created'; sessionId: string; peerPublicKey: string }
  | { type: 'session-rotated'; oldSessionId: string; newSessionId: string }
  | { type: 'session-expired'; sessionId: string }
  | { type: 'keys-zeroed'; sessionId: string };

export type KeyManagerEventHandler = (event: KeyManagerEvent) => void;

/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */

const INDEXEDDB_NAME = 'phantomchat-keystore';
const INDEXEDDB_VERSION = 1;
const IDENTITY_STORE = 'identity-keys';

/** Default rotation policy: rotate after 100 messages or 1 hour */
const DEFAULT_ROTATION_POLICY: RotationPolicy = {
  maxMessages: 100,
  maxAgeMs: 60 * 60 * 1000, // 1 hour
};

/* ═══════════════════════════════════════════
   KEY MANAGER CLASS
   ═══════════════════════════════════════════ */

export class KeyManager {
  private identityKeypair: PhantomKeypair | null = null;
  private activeSessions: Map<string, EphemeralSession> = new Map();
  private rotationPolicy: RotationPolicy;
  private eventHandlers: Set<KeyManagerEventHandler> = new Set();
  private rotationTimer: ReturnType<typeof setInterval> | null = null;

  constructor(policy: RotationPolicy = DEFAULT_ROTATION_POLICY) {
    this.rotationPolicy = policy;
  }

  /* ─── Event System ─── */

  /**
   * Subscribe to key lifecycle events.
   * @param handler - Callback invoked on each event
   * @returns Unsubscribe function
   */
  onEvent(handler: KeyManagerEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(event: KeyManagerEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Never let a handler crash the key manager
      }
    }
  }

  /* ─── Initialization ─── */

  /**
   * Initialize the key manager.
   * Loads existing identity from IndexedDB or generates a new one.
   *
   * @param encryptionKey - 32-byte key derived from user password (via Argon2)
   *                        used to encrypt/decrypt the identity secret key at rest
   * @returns The public key (base64) for server registration
   */
  async initialize(encryptionKey: Uint8Array): Promise<string> {
    await initPhantomEngine();

    // Try to load existing identity
    const stored = await this.loadIdentityFromDB();

    if (stored) {
      // Decrypt the stored secret key
      this.identityKeypair = await this.decryptIdentityKey(stored, encryptionKey);
    } else {
      // Generate new identity keypair
      this.identityKeypair = generateIdentityKeypair();

      // Encrypt and persist to IndexedDB
      const encrypted = await this.encryptIdentityKey(this.identityKeypair, encryptionKey);
      await this.saveIdentityToDB(encrypted);

      this.emit({
        type: 'identity-created',
        publicKey: exportPublicKey(this.identityKeypair.publicKey),
      });
    }

    // Start the rotation check timer
    this.startRotationTimer();

    return exportPublicKey(this.identityKeypair.publicKey);
  }

  /* ─── Identity Key Encryption/Decryption ─── */

  /**
   * Encrypt the identity secret key for safe storage in IndexedDB.
   * Uses XChaCha20-Poly1305 with the Argon2-derived encryption key.
   */
  private async encryptIdentityKey(
    keypair: PhantomKeypair,
    encryptionKey: Uint8Array
  ): Promise<EncryptedIdentityKey> {
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = sodium.crypto_secretbox_easy(
      keypair.secretKey,
      nonce,
      encryptionKey
    );

    return {
      nonce: sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
      ciphertext: sodium.to_base64(ciphertext, sodium.base64_variants.ORIGINAL),
      publicKey: exportPublicKey(keypair.publicKey),
    };
  }

  /**
   * Decrypt the identity secret key from IndexedDB storage.
   */
  private async decryptIdentityKey(
    stored: EncryptedIdentityKey,
    encryptionKey: Uint8Array
  ): Promise<PhantomKeypair> {
    const nonce = sodium.from_base64(stored.nonce, sodium.base64_variants.ORIGINAL);
    const ciphertext = sodium.from_base64(stored.ciphertext, sodium.base64_variants.ORIGINAL);

    const secretKey = sodium.crypto_secretbox_open_easy(ciphertext, nonce, encryptionKey);
    const publicKey = importPublicKey(stored.publicKey);

    // SECURITY: zeroing intermediate buffers
    sodium.memzero(nonce);
    sodium.memzero(ciphertext);

    return { publicKey, secretKey };
  }

  /* ─── IndexedDB Operations ─── */

  /**
   * Open the IndexedDB database for key storage.
   */
  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(INDEXEDDB_NAME, INDEXEDDB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDENTITY_STORE)) {
          db.createObjectStore(IDENTITY_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load the encrypted identity key from IndexedDB.
   */
  private async loadIdentityFromDB(): Promise<EncryptedIdentityKey | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDENTITY_STORE, 'readonly');
      const store = tx.objectStore(IDENTITY_STORE);
      const request = store.get('primary');

      request.onsuccess = () => {
        const result = request.result as
          | (EncryptedIdentityKey & { id: string })
          | undefined;
        if (result) {
          const { nonce, ciphertext, publicKey } = result;
          resolve({ nonce, ciphertext, publicKey });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
      db.close();
    });
  }

  /**
   * Save the encrypted identity key to IndexedDB.
   */
  private async saveIdentityToDB(encrypted: EncryptedIdentityKey): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDENTITY_STORE, 'readwrite');
      const store = tx.objectStore(IDENTITY_STORE);
      store.put({ id: 'primary', ...encrypted });
      tx.oncomplete = () => {
        resolve();
        db.close();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Delete the identity key from IndexedDB (account wipe).
   */
  async deleteIdentityFromDB(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDENTITY_STORE, 'readwrite');
      const store = tx.objectStore(IDENTITY_STORE);
      store.delete('primary');
      tx.oncomplete = () => {
        resolve();
        db.close();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ─── Ephemeral Session Management ─── */

  /**
   * Create a new ephemeral session with a peer.
   *
   * An ephemeral session generates a fresh X25519 keypair. Combined with
   * the peer's public key, this provides Forward Secrecy: if the identity
   * key is later compromised, messages from this session remain secure
   * because the ephemeral secret key is held in memory only and zeroed
   * after the session expires.
   *
   * @param peerPublicKey - Peer's public key (base64 string or Uint8Array)
   * @returns Session ID and our ephemeral public key for the peer
   */
  createSession(peerPublicKey: string | Uint8Array): {
    sessionId: string;
    ephemeralPublicKey: string;
  } {
    const peerPub =
      typeof peerPublicKey === 'string' ? importPublicKey(peerPublicKey) : peerPublicKey;

    const keypair = generateEphemeralKeypair();
    const sessionId = crypto.randomUUID();

    const session: EphemeralSession = {
      sessionId,
      keypair,
      peerPublicKey: peerPub,
      createdAt: Date.now(),
      messageCount: 0,
    };

    this.activeSessions.set(sessionId, session);

    this.emit({
      type: 'session-created',
      sessionId,
      peerPublicKey: exportPublicKey(peerPub),
    });

    return {
      sessionId,
      ephemeralPublicKey: exportPublicKey(keypair.publicKey),
    };
  }

  /**
   * Get the ephemeral keypair for a session (for encryption/decryption).
   * Increments the message counter for rotation tracking.
   *
   * @param sessionId - The session to retrieve
   * @returns The session's ephemeral keypair and peer public key
   * @throws If session does not exist or has expired
   */
  getSessionKeys(sessionId: string): {
    ourKeypair: PhantomKeypair;
    peerPublicKey: Uint8Array;
  } {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found or expired`);
    }

    // Check if rotation is needed
    if (this.shouldRotate(session)) {
      throw new Error(
        `Session ${sessionId} needs rotation. Call rotateSession() first.`
      );
    }

    session.messageCount += 1;

    return {
      ourKeypair: session.keypair,
      peerPublicKey: session.peerPublicKey,
    };
  }

  /**
   * Check whether a session should be rotated based on the rotation policy.
   */
  private shouldRotate(session: EphemeralSession): boolean {
    const age = Date.now() - session.createdAt;
    return (
      session.messageCount >= this.rotationPolicy.maxMessages ||
      age >= this.rotationPolicy.maxAgeMs
    );
  }

  /**
   * Rotate an ephemeral session: zero the old keys and generate fresh ones.
   *
   * @param sessionId - The session to rotate
   * @returns The new session ID and ephemeral public key
   */
  rotateSession(sessionId: string): {
    newSessionId: string;
    ephemeralPublicKey: string;
  } {
    const oldSession = this.activeSessions.get(sessionId);
    if (!oldSession) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Zero old key material
    // SECURITY: zeroing key material
    sodium.memzero(oldSession.keypair.secretKey);

    this.activeSessions.delete(sessionId);

    this.emit({ type: 'keys-zeroed', sessionId });

    // Create a new session with the same peer
    const result = this.createSession(oldSession.peerPublicKey);

    this.emit({
      type: 'session-rotated',
      oldSessionId: sessionId,
      newSessionId: result.sessionId,
    });

    return {
      newSessionId: result.sessionId,
      ephemeralPublicKey: result.ephemeralPublicKey,
    };
  }

  /**
   * Explicitly destroy a session and zero all its key material.
   *
   * @param sessionId - The session to destroy
   */
  destroySession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      // SECURITY: zeroing key material
      sodium.memzero(session.keypair.secretKey);
      this.activeSessions.delete(sessionId);
      this.emit({ type: 'session-expired', sessionId });
      this.emit({ type: 'keys-zeroed', sessionId });
    }
  }

  /**
   * Get the identity public key (safe to share).
   */
  getPublicKey(): string {
    if (!this.identityKeypair) {
      throw new Error('KeyManager not initialized');
    }
    return exportPublicKey(this.identityKeypair.publicKey);
  }

  /**
   * Get the identity secret key (NEVER share this).
   * Used internally for decrypting messages addressed to our identity key.
   */
  getSecretKey(): Uint8Array {
    if (!this.identityKeypair) {
      throw new Error('KeyManager not initialized');
    }
    return this.identityKeypair.secretKey;
  }

  /**
   * List all active session IDs and their status.
   */
  listSessions(): Array<{
    sessionId: string;
    peerPublicKey: string;
    messageCount: number;
    ageMs: number;
    needsRotation: boolean;
  }> {
    const now = Date.now();
    return Array.from(this.activeSessions.values()).map((s) => ({
      sessionId: s.sessionId,
      peerPublicKey: exportPublicKey(s.peerPublicKey),
      messageCount: s.messageCount,
      ageMs: now - s.createdAt,
      needsRotation: this.shouldRotate(s),
    }));
  }

  /* ─── Rotation Timer ─── */

  /**
   * Start a periodic check for sessions that need rotation or cleanup.
   */
  private startRotationTimer(): void {
    if (this.rotationTimer) return;

    this.rotationTimer = setInterval(() => {
      for (const [sessionId, session] of this.activeSessions) {
        if (this.shouldRotate(session)) {
          // Auto-destroy expired sessions (the application layer should
          // detect this via events and re-create if needed)
          this.destroySession(sessionId);
        }
      }
    }, 30_000); // Check every 30 seconds
  }

  /* ─── Cleanup ─── */

  /**
   * Destroy the key manager: zero ALL key material and stop timers.
   * Call this on logout / page unload.
   */
  destroy(): void {
    // Zero identity key
    if (this.identityKeypair) {
      // SECURITY: zeroing key material
      sodium.memzero(this.identityKeypair.secretKey);
      this.identityKeypair = null;
    }

    // Zero all session keys
    for (const [sessionId] of this.activeSessions) {
      this.destroySession(sessionId);
    }
    this.activeSessions.clear();

    // Stop rotation timer
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }

    // Clear event handlers
    this.eventHandlers.clear();
  }
}

/**
 * Singleton instance for the application.
 * Prefer using this over creating multiple instances.
 */
export const keyManager = new KeyManager();
