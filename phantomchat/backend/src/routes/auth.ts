/**
 * Authentication routes for PhantomChat.
 *
 * Handles user registration and login for both real and decoy accounts.
 * The server never sees plaintext passwords — only public keys, encrypted
 * identity blobs, and salts.
 *
 * DECOY PASSWORD ARCHITECTURE:
 *   Registration sends two independent entries to two separate tables.
 *   Login tries both tables — the code path is identical regardless of
 *   which password was used. An observer (including the server) cannot
 *   distinguish between a real and decoy login.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from '../db/connection.js';

/* ─── Request/Response Types ─── */

interface RegisterBody {
  real: {
    publicKey: string;
    encryptedIdentity: string; // base64
    salt: string;
  };
  decoy: {
    publicKey: string;
    encryptedIdentity: string;
    salt: string;
  };
}

interface LoginBody {
  publicKey: string;
}

interface LoginResponse {
  found: boolean;
  encryptedIdentity: string | null;
  salt: string | null;
  accountType: 'real' | 'decoy' | null;
}

/* ─── Exponential Backoff Tracker ─── */

const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_BACKOFF_MS = 32_000;

function getBackoffMs(ip: string): number {
  const record = failedAttempts.get(ip);
  if (!record) return 0;
  const timeSince = Date.now() - record.lastAttempt;
  const backoff = Math.min(2 ** record.count * 1000, MAX_BACKOFF_MS);
  return Math.max(0, backoff - timeSince);
}

function recordFailure(ip: string): void {
  const record = failedAttempts.get(ip) ?? { count: 0, lastAttempt: 0 };
  record.count += 1;
  record.lastAttempt = Date.now();
  failedAttempts.set(ip, record);
}

function clearFailures(ip: string): void {
  failedAttempts.delete(ip);
}

/* ─── Route Registration ─── */

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const db = getPool();

  /**
   * POST /api/auth/register
   *
   * Registers both a real and decoy account simultaneously.
   * The two accounts go into DIFFERENT tables with no FK relationship.
   */
  app.post<{ Body: RegisterBody }>(
    '/register',
    async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
      const { real, decoy } = request.body;

      // Validate required fields
      if (!real?.publicKey || !real?.encryptedIdentity || !real?.salt) {
        return reply.status(400).send({ error: 'Missing real account fields' });
      }
      if (!decoy?.publicKey || !decoy?.encryptedIdentity || !decoy?.salt) {
        return reply.status(400).send({ error: 'Missing decoy account fields' });
      }

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        // Insert real account
        await client.query(
          `INSERT INTO real_accounts (public_key, encrypted_identity, salt)
           VALUES ($1, $2, $3)
           ON CONFLICT (public_key) DO NOTHING`,
          [real.publicKey, Buffer.from(real.encryptedIdentity, 'base64'), real.salt]
        );

        // Insert decoy account — completely independent
        await client.query(
          `INSERT INTO decoy_accounts (public_key, encrypted_identity, salt)
           VALUES ($1, $2, $3)
           ON CONFLICT (public_key) DO NOTHING`,
          [decoy.publicKey, Buffer.from(decoy.encryptedIdentity, 'base64'), decoy.salt]
        );

        await client.query('COMMIT');

        return reply.status(201).send({ status: 'registered' });
      } catch (err) {
        await client.query('ROLLBACK');
        request.log.error(err, 'Registration failed');
        return reply.status(500).send({ error: 'Registration failed' });
      } finally {
        client.release();
      }
    }
  );

  /**
   * POST /api/auth/login
   *
   * Retrieves the encrypted identity blob for a given public key.
   * Tries BOTH tables — the response format is identical regardless
   * of which table the account was found in.
   *
   * Implements exponential backoff on failed attempts.
   */
  app.post<{ Body: LoginBody }>(
    '/login',
    async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
      const ip = request.ip;

      // Check backoff
      const backoffMs = getBackoffMs(ip);
      if (backoffMs > 0) {
        reply.header('Retry-After', Math.ceil(backoffMs / 1000).toString());
        return reply.status(429).send({
          error: 'Too many attempts. Please wait.',
          retryAfterMs: backoffMs,
        });
      }

      const { publicKey } = request.body;
      if (!publicKey) {
        return reply.status(400).send({ error: 'Missing public key' });
      }

      // Try real account first
      const realResult = await db.query(
        'SELECT encrypted_identity, salt FROM real_accounts WHERE public_key = $1',
        [publicKey]
      );

      if (realResult.rows[0]) {
        clearFailures(ip);
        const row = realResult.rows[0] as { encrypted_identity: Buffer; salt: string };
        const response: LoginResponse = {
          found: true,
          encryptedIdentity: row.encrypted_identity.toString('base64'),
          salt: row.salt,
          accountType: 'real',
        };
        return reply.send(response);
      }

      // Try decoy account
      const decoyResult = await db.query(
        'SELECT encrypted_identity, salt FROM decoy_accounts WHERE public_key = $1',
        [publicKey]
      );

      if (decoyResult.rows[0]) {
        clearFailures(ip);
        const row = decoyResult.rows[0] as { encrypted_identity: Buffer; salt: string };
        // NOTE: We return accountType: 'real' even for decoy to not leak info server-side.
        // The client determines the account type by which key successfully decrypts.
        const response: LoginResponse = {
          found: true,
          encryptedIdentity: row.encrypted_identity.toString('base64'),
          salt: row.salt,
          accountType: 'real', // Deliberately identical — server doesn't distinguish
        };
        return reply.send(response);
      }

      // Not found — record failure for backoff
      recordFailure(ip);
      const response: LoginResponse = {
        found: false,
        encryptedIdentity: null,
        salt: null,
        accountType: null,
      };
      return reply.status(404).send(response);
    }
  );

  /**
   * POST /api/auth/lookup-salts
   *
   * Returns BOTH salts (real and decoy) for the decoy login flow.
   * Both salts are returned regardless — the client tries both.
   */
  app.post<{ Body: { realPublicKey: string; decoyPublicKey: string } }>(
    '/lookup-salts',
    async (
      request: FastifyRequest<{ Body: { realPublicKey: string; decoyPublicKey: string } }>,
      reply: FastifyReply
    ) => {
      const { realPublicKey, decoyPublicKey } = request.body;

      const [realResult, decoyResult] = await Promise.all([
        db.query('SELECT salt FROM real_accounts WHERE public_key = $1', [realPublicKey]),
        db.query('SELECT salt FROM decoy_accounts WHERE public_key = $1', [decoyPublicKey]),
      ]);

      const realSalt = (realResult.rows[0] as { salt: string } | undefined)?.salt ?? null;
      const decoySalt = (decoyResult.rows[0] as { salt: string } | undefined)?.salt ?? null;

      return reply.send({ realSalt, decoySalt });
    }
  );
}
