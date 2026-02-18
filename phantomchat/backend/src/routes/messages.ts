/**
 * Message routes for PhantomChat.
 *
 * Handles encrypted message storage, retrieval, self-destruct key management,
 * and burn-after-read semantics.
 *
 * ZERO-KNOWLEDGE: The server stores messages as opaque JSONB blobs.
 * It cannot decrypt them — it only manages storage, TTL, and delivery.
 *
 * SELF-DESTRUCT MECHANISM:
 *   Messages are NOT deleted. The DECRYPTION KEY is stored separately
 *   with a TTL. When the TTL expires, the key row is deleted — the
 *   message blob remains but is permanently undecryptable.
 *   This is more robust than deletion because:
 *     1. The blob can exist in backups — still useless without the key
 *     2. No complex cascade logic needed
 *     3. Crypto-shredding is a proven pattern (NIST SP 800-88)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from '../db/connection.js';

/* ─── Request Types ─── */

interface SendMessageBody {
  messageId: string;
  senderPublicKey: string;
  recipientPublicKey: string;
  ciphertextBlob: Record<string, unknown>;
  lamportTs: number;
  /** Optional: encrypted decryption key for self-destruct */
  encryptedKey?: string;
  /** Optional: TTL in seconds for the decryption key */
  ttlSeconds?: number;
  /** Whether to delete the key after first read */
  burnAfterRead?: boolean;
}

interface GetMessagesQuery {
  recipientPublicKey: string;
  afterLamportTs?: string;
}

/* ─── Route Registration ─── */

export async function messageRoutes(app: FastifyInstance): Promise<void> {
  const db = getPool();

  // Start the expired key cleanup job
  startKeyCleanupJob();

  /**
   * POST /api/messages
   *
   * Store an encrypted message blob and optionally a self-destruct key.
   */
  app.post<{ Body: SendMessageBody }>(
    '/',
    async (request: FastifyRequest<{ Body: SendMessageBody }>, reply: FastifyReply) => {
      const {
        messageId,
        senderPublicKey,
        recipientPublicKey,
        ciphertextBlob,
        lamportTs,
        encryptedKey,
        ttlSeconds,
        burnAfterRead,
      } = request.body;

      if (!messageId || !senderPublicKey || !recipientPublicKey || !ciphertextBlob) {
        return reply.status(400).send({ error: 'Missing required fields' });
      }

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        // Store the encrypted message blob
        await client.query(
          `INSERT INTO messages (id, sender_public_key, recipient_public_key, ciphertext_blob, lamport_ts)
           VALUES ($1, $2, $3, $4, $5)`,
          [messageId, senderPublicKey, recipientPublicKey, ciphertextBlob, lamportTs]
        );

        // If self-destruct: store the decryption key with TTL
        if (encryptedKey) {
          const expiresAt = ttlSeconds
            ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
            : null;

          await client.query(
            `INSERT INTO message_keys (message_id, encrypted_key, burn_after_read, expires_at)
             VALUES ($1, $2, $3, $4)`,
            [
              messageId,
              Buffer.from(encryptedKey, 'base64'),
              burnAfterRead ?? false,
              expiresAt,
            ]
          );
        }

        await client.query('COMMIT');
        return reply.status(201).send({ status: 'stored', messageId });
      } catch (err) {
        await client.query('ROLLBACK');
        request.log.error(err, 'Failed to store message');
        return reply.status(500).send({ error: 'Failed to store message' });
      } finally {
        client.release();
      }
    }
  );

  /**
   * GET /api/messages
   *
   * Retrieve encrypted messages for a recipient.
   * Supports pagination via afterLamportTs (append-only model).
   */
  app.get<{ Querystring: GetMessagesQuery }>(
    '/',
    async (
      request: FastifyRequest<{ Querystring: GetMessagesQuery }>,
      reply: FastifyReply
    ) => {
      const { recipientPublicKey, afterLamportTs } = request.query;

      if (!recipientPublicKey) {
        return reply.status(400).send({ error: 'Missing recipientPublicKey' });
      }

      const afterTs = afterLamportTs ? Number(afterLamportTs) : 0;

      const result = await db.query(
        `SELECT id, sender_public_key, ciphertext_blob, lamport_ts, created_at
         FROM messages
         WHERE recipient_public_key = $1 AND lamport_ts > $2
         ORDER BY lamport_ts ASC
         LIMIT 100`,
        [recipientPublicKey, afterTs]
      );

      type MessageRow = {
        id: string;
        sender_public_key: string;
        ciphertext_blob: Record<string, unknown>;
        lamport_ts: string;
        created_at: string;
      };

      return reply.send({
        messages: (result.rows as MessageRow[]).map((row) => ({
          messageId: row.id,
          senderPublicKey: row.sender_public_key,
          ciphertextBlob: row.ciphertext_blob,
          lamportTs: Number(row.lamport_ts),
          createdAt: row.created_at,
        })),
      });
    }
  );

  /**
   * GET /api/messages/:messageId/key
   *
   * Retrieve the decryption key for a self-destruct or burn-after-read message.
   *
   * BURN-AFTER-READ: If burn_after_read is true, the key is deleted
   * immediately after this request returns. The message blob remains
   * but is permanently undecryptable.
   */
  app.get<{ Params: { messageId: string } }>(
    '/:messageId/key',
    async (
      request: FastifyRequest<{ Params: { messageId: string } }>,
      reply: FastifyReply
    ) => {
      const { messageId } = request.params;

      const result = await db.query(
        `SELECT encrypted_key, burn_after_read, expires_at, is_read
         FROM message_keys
         WHERE message_id = $1`,
        [messageId]
      );

      type KeyRow = {
        encrypted_key: Buffer;
        burn_after_read: boolean;
        expires_at: string | null;
        is_read: boolean;
      };

      const row = result.rows[0] as KeyRow | undefined;

      if (!row) {
        return reply.status(404).send({
          error: 'Key not found — message may have self-destructed',
        });
      }

      // Check if key has expired
      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        // Delete expired key
        await db.query('DELETE FROM message_keys WHERE message_id = $1', [messageId]);
        return reply.status(410).send({
          error: 'Key expired — message has self-destructed',
        });
      }

      // Handle burn-after-read: delete key after returning it
      if (row.burn_after_read) {
        if (row.is_read) {
          // Already read once — key should be gone, but handle edge case
          await db.query('DELETE FROM message_keys WHERE message_id = $1', [messageId]);
          return reply.status(410).send({
            error: 'Key already burned after first read',
          });
        }

        // Mark as read and then delete in the next request
        // We return the key this one time, then it's gone forever
        await db.query(
          'DELETE FROM message_keys WHERE message_id = $1',
          [messageId]
        );
      } else {
        // Normal self-destruct: just mark as read
        await db.query(
          'UPDATE message_keys SET is_read = TRUE WHERE message_id = $1',
          [messageId]
        );
      }

      return reply.send({
        encryptedKey: row.encrypted_key.toString('base64'),
        burnAfterRead: row.burn_after_read,
      });
    }
  );

  /**
   * DELETE /api/messages/:messageId
   *
   * Manually delete a message's decryption key (crypto-shredding).
   * The message blob remains but becomes permanently undecryptable.
   */
  app.delete<{ Params: { messageId: string } }>(
    '/:messageId',
    async (
      request: FastifyRequest<{ Params: { messageId: string } }>,
      reply: FastifyReply
    ) => {
      const { messageId } = request.params;

      await db.query('DELETE FROM message_keys WHERE message_id = $1', [messageId]);

      return reply.send({ status: 'key_deleted', messageId });
    }
  );
}

/**
 * Background job: periodically delete expired message keys.
 *
 * Runs every 30 seconds. Deletes all keys where expires_at < NOW().
 * This implements the self-destruct mechanism: once the key is gone,
 * the encrypted blob is worthless.
 */
function startKeyCleanupJob(): void {
  const db = getPool();

  setInterval(async () => {
    try {
      const result = await db.query(
        "DELETE FROM message_keys WHERE expires_at IS NOT NULL AND expires_at < NOW()"
      );
      if (result.rowCount && result.rowCount > 0) {
        console.log(`Cleaned up ${result.rowCount} expired message keys`);
      }
    } catch (err) {
      console.error('Key cleanup job error:', err);
    }
  }, 30_000);
}
