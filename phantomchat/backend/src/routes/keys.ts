/**
 * Public key exchange routes for PhantomChat.
 *
 * Manages the server-side public key directory. Users upload their
 * X25519 public keys so peers can look them up for ECDH key exchange.
 *
 * The server stores ONLY public keys — never private keys.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from '../db/connection.js';

/* ─── Request Types ─── */

interface RegisterKeyBody {
  publicKey: string;
  displayName?: string;
}

interface LookupKeyQuery {
  publicKey: string;
}

/* ─── Route Registration ─── */

export async function keyRoutes(app: FastifyInstance): Promise<void> {
  const db = getPool();

  /**
   * POST /api/keys/register
   *
   * Register or update a public key in the directory.
   */
  app.post<{ Body: RegisterKeyBody }>(
    '/register',
    async (request: FastifyRequest<{ Body: RegisterKeyBody }>, reply: FastifyReply) => {
      const { publicKey, displayName } = request.body;

      if (!publicKey) {
        return reply.status(400).send({ error: 'Missing publicKey' });
      }

      // Check if key exists in either real or decoy accounts
      const [realResult, decoyResult] = await Promise.all([
        db.query('SELECT id FROM real_accounts WHERE public_key = $1', [publicKey]),
        db.query('SELECT id FROM decoy_accounts WHERE public_key = $1', [publicKey]),
      ]);

      if (!realResult.rows[0] && !decoyResult.rows[0]) {
        return reply.status(404).send({ error: 'Account not found for this public key' });
      }

      return reply.send({
        status: 'registered',
        publicKey,
        displayName: displayName ?? 'Anonymous',
      });
    }
  );

  /**
   * GET /api/keys/lookup
   *
   * Look up whether a public key exists in the system.
   * Used by peers to verify a contact's key before starting a conversation.
   */
  app.get<{ Querystring: LookupKeyQuery }>(
    '/lookup',
    async (
      request: FastifyRequest<{ Querystring: LookupKeyQuery }>,
      reply: FastifyReply
    ) => {
      const { publicKey } = request.query;

      if (!publicKey) {
        return reply.status(400).send({ error: 'Missing publicKey' });
      }

      // Check both tables — server doesn't reveal which table it was found in
      const [realResult, decoyResult] = await Promise.all([
        db.query('SELECT id FROM real_accounts WHERE public_key = $1', [publicKey]),
        db.query('SELECT id FROM decoy_accounts WHERE public_key = $1', [publicKey]),
      ]);

      const found = !!(realResult.rows[0] || decoyResult.rows[0]);

      return reply.send({ found, publicKey });
    }
  );

  /**
   * GET /api/keys/group/:groupId
   *
   * Get all public keys for members of a group.
   */
  app.get<{ Params: { groupId: string } }>(
    '/group/:groupId',
    async (
      request: FastifyRequest<{ Params: { groupId: string } }>,
      reply: FastifyReply
    ) => {
      const { groupId } = request.params;

      const result = await db.query(
        `SELECT public_key, joined_at
         FROM group_members
         WHERE group_id = $1
         ORDER BY joined_at ASC`,
        [groupId]
      );

      type MemberRow = { public_key: string; joined_at: string };

      return reply.send({
        groupId,
        members: (result.rows as MemberRow[]).map((row) => ({
          publicKey: row.public_key,
          joinedAt: row.joined_at,
        })),
      });
    }
  );

  /**
   * POST /api/keys/group
   *
   * Create a new group and add initial members.
   */
  app.post<{ Body: { name: string; memberPublicKeys: string[] } }>(
    '/group',
    async (
      request: FastifyRequest<{ Body: { name: string; memberPublicKeys: string[] } }>,
      reply: FastifyReply
    ) => {
      const { name, memberPublicKeys } = request.body;

      if (!name || !memberPublicKeys?.length) {
        return reply.status(400).send({ error: 'Missing name or members' });
      }

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        const groupResult = await client.query(
          'INSERT INTO groups (name) VALUES ($1) RETURNING id',
          [name]
        );
        const groupId = (groupResult.rows[0] as { id: string }).id;

        for (const publicKey of memberPublicKeys) {
          await client.query(
            'INSERT INTO group_members (group_id, public_key) VALUES ($1, $2)',
            [groupId, publicKey]
          );
        }

        await client.query('COMMIT');
        return reply.status(201).send({ groupId, name, memberCount: memberPublicKeys.length });
      } catch (err) {
        await client.query('ROLLBACK');
        request.log.error(err, 'Failed to create group');
        return reply.status(500).send({ error: 'Failed to create group' });
      } finally {
        client.release();
      }
    }
  );
}
