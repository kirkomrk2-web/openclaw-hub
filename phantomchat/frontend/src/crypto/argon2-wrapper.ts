/**
 * PhantomChat Argon2id Wrapper — Password Hashing & Key Derivation
 *
 * Uses libsodium's Argon2id implementation for:
 *   1. Password-based key derivation (login → encryption key)
 *   2. Decoy password support (two independent derivations)
 *
 * WHY ARGON2id:
 *   - Memory-hard: resists GPU/ASIC brute-force attacks by requiring large
 *     amounts of RAM (64 MB in our configuration)
 *   - Argon2id is the hybrid variant: first pass uses Argon2i (data-independent
 *     access pattern, resists side-channel attacks), subsequent passes use
 *     Argon2d (data-dependent, stronger against GPU attacks)
 *   - Winner of the Password Hashing Competition (2015), widely audited
 *
 * DECOY PASSWORD ARCHITECTURE:
 *   The user has TWO passwords:
 *     - Real password → derives a key that unlocks the real account
 *     - Decoy password → derives a DIFFERENT key that unlocks a decoy account
 *   The login code is IDENTICAL for both — only the derived key differs.
 *   An attacker watching the login process cannot tell which password was used.
 *   The real and decoy accounts are stored in SEPARATE database tables with
 *   NO foreign key relationship, so a database dump reveals no correlation.
 *
 * COST PARAMETERS:
 *   - Memory: 64 MB (65536 KiB) — makes each guess expensive in RAM
 *   - Iterations: 3 — number of passes over memory
 *   - Parallelism: 1 — single-threaded (we're in a browser main thread)
 *
 * SECURITY: All intermediate buffers are zeroed after use.
 */

import sodium from 'libsodium-wrappers';
import { initPhantomEngine } from './phantom-engine';

/* ═══════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════ */

/** Result of a key derivation operation */
export interface DerivedKey {
  /** The 32-byte derived key for encryption operations */
  key: Uint8Array;
  /** The salt used (must be stored alongside the encrypted data) */
  salt: string; // base64
  /** Which account type this key is for */
  accountType: 'real' | 'decoy';
}

/** Stored salt pair for a user (one for each account type) */
export interface StoredSalts {
  /** Salt for the real account (base64) */
  realSalt: string;
  /** Salt for the decoy account (base64) — stored separately */
  decoySalt: string;
}

/** Configuration for Argon2id cost parameters */
export interface Argon2Config {
  /** Memory cost in bytes */
  memoryBytes: number;
  /** Number of iterations (passes over memory) */
  iterations: number;
  /** Output key length in bytes */
  keyLength: number;
}

/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */

/**
 * Argon2id parameters.
 *
 * 64 MB memory with 3 iterations provides strong resistance against:
 *   - GPU attacks: 64 MB per guess × thousands of parallel guesses = impractical
 *   - ASIC attacks: memory-hardness makes custom hardware expensive
 *   - Side-channel attacks: Argon2id's hybrid approach mitigates timing leaks
 *
 * On a modern laptop this takes approximately 0.5-2 seconds — acceptable for login.
 */
const ARGON2_CONFIG: Argon2Config = {
  memoryBytes: 64 * 1024 * 1024, // 64 MB
  iterations: 3,
  keyLength: 32, // 256-bit key
};

/**
 * Salt length: 16 bytes (128 bits).
 * This is the recommended minimum from the Argon2 spec.
 * A unique random salt per user prevents rainbow table attacks.
 */
const SALT_LENGTH = 16; // bytes

/**
 * Libsodium's Argon2id OPSLIMITs and MEMLIMITs don't directly correspond
 * to our desired 64MB/3 iterations, so we use crypto_pwhash directly
 * with manual parameters via the low-level API.
 */
const ARGON2_OPSLIMIT = 3; // iterations
const ARGON2_MEMLIMIT = 64 * 1024 * 1024; // 64 MB in bytes

/* ═══════════════════════════════════════════
   CORE FUNCTIONS
   ═══════════════════════════════════════════ */

/**
 * Derive a 32-byte encryption key from a password using Argon2id.
 *
 * This is the fundamental operation: password + salt → key.
 * The salt MUST be stored (it's not secret) alongside the encrypted data
 * so we can re-derive the same key during login.
 *
 * @param password - The user's password (UTF-8 string)
 * @param salt     - 16-byte salt (if null, a random salt is generated)
 * @returns The derived key and the salt used
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array | null = null
): Promise<{ key: Uint8Array; salt: Uint8Array }> {
  await initPhantomEngine();

  // Generate random salt if not provided
  const usedSalt = salt ?? sodium.randombytes_buf(SALT_LENGTH);

  // Convert password to bytes
  const passwordBytes = sodium.from_string(password);

  // Derive key using Argon2id
  // libsodium's crypto_pwhash uses Argon2id by default (ALG_ARGON2ID13)
  const key = sodium.crypto_pwhash(
    ARGON2_CONFIG.keyLength,
    passwordBytes,
    usedSalt,
    ARGON2_OPSLIMIT,
    ARGON2_MEMLIMIT,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  );

  // SECURITY: zeroing password bytes — the original string is in JS heap
  // and can't be zeroed, but we zero the Uint8Array copy
  sodium.memzero(passwordBytes);

  return { key, salt: usedSalt };
}

/**
 * Generate a new random salt for Argon2id.
 * @returns 16-byte random salt
 */
export function generateSalt(): Uint8Array {
  return sodium.randombytes_buf(SALT_LENGTH);
}

/* ═══════════════════════════════════════════
   DECOY PASSWORD SYSTEM
   ═══════════════════════════════════════════

   The decoy system works as follows:

   REGISTRATION:
     1. User provides a real password and a decoy password
     2. We generate TWO independent random salts
     3. We derive TWO independent keys:
        - realKey  = Argon2id(realPassword, realSalt)
        - decoyKey = Argon2id(decoyPassword, decoySalt)
     4. realKey is used to encrypt the identity keypair for the real account
     5. decoyKey is used to encrypt the identity keypair for the decoy account
     6. The two accounts are stored in DIFFERENT database tables (no FK)
     7. The salts are stored: realSalt in the real table, decoySalt in the decoy table

   LOGIN:
     1. User enters a password (could be real or decoy)
     2. We try to derive a key using the real salt → try to decrypt real identity
     3. If that fails, we try the decoy salt → try to decrypt decoy identity
     4. From the server's perspective, both attempts look identical
     5. The server returns different encrypted blobs but can't tell which is "real"

   SECURITY PROPERTIES:
     - The two salts are completely unrelated random values
     - The two derived keys are cryptographically independent
     - An attacker with DB access sees two entries in different tables
       with no correlation (different UUIDs, different salts, different ciphertext)
     - The login code path is identical — no timing or control-flow leaks
*/

/**
 * Set up the decoy password system during registration.
 *
 * Generates TWO completely independent key derivations.
 *
 * @param realPassword  - The user's real password
 * @param decoyPassword - The user's decoy password
 * @returns Two independent DerivedKey objects
 */
export async function setupDecoyPasswords(
  realPassword: string,
  decoyPassword: string
): Promise<{ realKey: DerivedKey; decoyKey: DerivedKey }> {
  await initPhantomEngine();

  // Validate: passwords must be different
  if (realPassword === decoyPassword) {
    throw new Error('Real and decoy passwords must be different');
  }

  // Generate TWO independent random salts
  const realSalt = generateSalt();
  const decoySalt = generateSalt();

  // Derive TWO independent keys
  const realResult = await deriveKeyFromPassword(realPassword, realSalt);
  const decoyResult = await deriveKeyFromPassword(decoyPassword, decoySalt);

  return {
    realKey: {
      key: realResult.key,
      salt: sodium.to_base64(realSalt, sodium.base64_variants.ORIGINAL),
      accountType: 'real',
    },
    decoyKey: {
      key: decoyResult.key,
      salt: sodium.to_base64(decoySalt, sodium.base64_variants.ORIGINAL),
      accountType: 'decoy',
    },
  };
}

/**
 * Attempt login with a password by trying both real and decoy salts.
 *
 * The login flow is designed to be INDISTINGUISHABLE regardless of which
 * password is used:
 *   1. Try decrypting with the real salt → if it works, this is the real password
 *   2. Try decrypting with the decoy salt → if it works, this is the decoy password
 *   3. If neither works, the password is wrong
 *
 * IMPORTANT: Both attempts ALWAYS happen (no early return) to prevent
 * timing side-channels from revealing which type of password was entered.
 *
 * @param password  - The password to try
 * @param realSalt  - Salt for the real account (base64)
 * @param decoySalt - Salt for the decoy account (base64)
 * @param verifyFn  - Callback that tests whether a derived key successfully
 *                    decrypts the stored identity. Returns true on success.
 * @returns Which account type was unlocked, or null if password is wrong
 */
export async function attemptLogin(
  password: string,
  realSalt: string,
  decoySalt: string,
  verifyFn: (key: Uint8Array, accountType: 'real' | 'decoy') => Promise<boolean>
): Promise<{ key: Uint8Array; accountType: 'real' | 'decoy' } | null> {
  await initPhantomEngine();

  const realSaltBytes = sodium.from_base64(realSalt, sodium.base64_variants.ORIGINAL);
  const decoySaltBytes = sodium.from_base64(decoySalt, sodium.base64_variants.ORIGINAL);

  // Derive BOTH keys — always, to prevent timing leaks
  const realResult = await deriveKeyFromPassword(password, realSaltBytes);
  const decoyResult = await deriveKeyFromPassword(password, decoySaltBytes);

  // Try BOTH verifications — always, to prevent timing leaks
  let realSuccess = false;
  let decoySuccess = false;

  try {
    realSuccess = await verifyFn(realResult.key, 'real');
  } catch {
    realSuccess = false;
  }

  try {
    decoySuccess = await verifyFn(decoyResult.key, 'decoy');
  } catch {
    decoySuccess = false;
  }

  // Determine result — exactly one should succeed
  if (realSuccess) {
    // SECURITY: zeroing the decoy key since we don't need it
    sodium.memzero(decoyResult.key);
    sodium.memzero(realSaltBytes);
    sodium.memzero(decoySaltBytes);
    return { key: realResult.key, accountType: 'real' };
  }

  if (decoySuccess) {
    // SECURITY: zeroing the real key since we don't need it
    sodium.memzero(realResult.key);
    sodium.memzero(realSaltBytes);
    sodium.memzero(decoySaltBytes);
    return { key: decoyResult.key, accountType: 'decoy' };
  }

  // Both failed — wrong password
  // SECURITY: zeroing both keys
  sodium.memzero(realResult.key);
  sodium.memzero(decoyResult.key);
  sodium.memzero(realSaltBytes);
  sodium.memzero(decoySaltBytes);
  return null;
}

/**
 * Change a password (real or decoy) by re-deriving with a new salt.
 *
 * @param newPassword  - The new password
 * @param accountType  - Which account to update
 * @returns New DerivedKey with fresh salt
 */
export async function changePassword(
  newPassword: string,
  accountType: 'real' | 'decoy'
): Promise<DerivedKey> {
  await initPhantomEngine();

  const newSalt = generateSalt();
  const result = await deriveKeyFromPassword(newPassword, newSalt);

  return {
    key: result.key,
    salt: sodium.to_base64(newSalt, sodium.base64_variants.ORIGINAL),
    accountType,
  };
}

/* ═══════════════════════════════════════════
   UTILITY — PASSWORD STRENGTH CHECK
   ═══════════════════════════════════════════ */

/** Minimum password requirements */
export interface PasswordStrength {
  /** Meets minimum length (12 characters) */
  minLength: boolean;
  /** Contains uppercase letters */
  hasUppercase: boolean;
  /** Contains lowercase letters */
  hasLowercase: boolean;
  /** Contains digits */
  hasDigits: boolean;
  /** Contains special characters */
  hasSpecial: boolean;
  /** Overall score 0-5 */
  score: number;
  /** Human-readable strength label */
  label: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
}

/**
 * Evaluate password strength.
 * This is a client-side heuristic — NOT a substitute for Argon2id.
 *
 * @param password - The password to evaluate
 * @returns Strength assessment
 */
export function evaluatePasswordStrength(password: string): PasswordStrength {
  const minLength = password.length >= 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigits = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const score = [minLength, hasUppercase, hasLowercase, hasDigits, hasSpecial].filter(
    Boolean
  ).length;

  const labels: Record<number, PasswordStrength['label']> = {
    0: 'weak',
    1: 'weak',
    2: 'fair',
    3: 'good',
    4: 'strong',
    5: 'excellent',
  };

  return {
    minLength,
    hasUppercase,
    hasLowercase,
    hasDigits,
    hasSpecial,
    score,
    label: labels[score] ?? 'weak',
  };
}
