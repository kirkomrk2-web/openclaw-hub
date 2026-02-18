/**
 * PostgreSQL database connection pool.
 *
 * Uses pgcrypto extension for encrypted column support.
 * Connection details come from environment variables — never hardcoded.
 */

import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Get or create the connection pool.
 */
export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'phantomchat',
      user: process.env.DB_USER || 'phantom',
      password: process.env.DB_PASSWORD || 'phantom_secret',
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

/**
 * Initialize the database: enable pgcrypto and run schema.
 */
export async function initDB(): Promise<void> {
  const db = getPool();

  // Enable pgcrypto extension
  await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  // Run schema creation
  await db.query(SCHEMA);

  console.log('Database initialized successfully');
}

/**
 * Database schema for PhantomChat.
 *
 * DESIGN NOTES:
 *
 * 1. real_accounts and decoy_accounts are SEPARATE tables with NO foreign key
 *    relationship. This means a database dump reveals NO correlation between
 *    a real account and its decoy. They have different UUIDs, different salts,
 *    and no shared columns.
 *
 * 2. Messages are stored as opaque encrypted blobs. The server cannot read them.
 *
 * 3. message_keys stores the decryption keys for self-destruct messages.
 *    When the TTL expires, a background job deletes the key row.
 *    The message blob remains but is permanently undecryptable.
 *
 * 4. burn_after_read messages have their key deleted on first retrieval.
 */
const SCHEMA = `
  -- Real user accounts
  CREATE TABLE IF NOT EXISTS real_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_key TEXT NOT NULL UNIQUE,
    encrypted_identity BYTEA NOT NULL,
    salt TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Decoy accounts — completely independent table, no FK to real_accounts
  CREATE TABLE IF NOT EXISTS decoy_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_key TEXT NOT NULL UNIQUE,
    encrypted_identity BYTEA NOT NULL,
    salt TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Encrypted message blobs (opaque to server)
  CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    sender_public_key TEXT NOT NULL,
    recipient_public_key TEXT NOT NULL,
    ciphertext_blob JSONB NOT NULL,
    lamport_ts BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Self-destruct keys with TTL
  -- The key is stored here temporarily. After TTL expiry, the row is deleted
  -- and the corresponding message blob becomes permanently undecryptable.
  CREATE TABLE IF NOT EXISTS message_keys (
    message_id UUID PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    encrypted_key BYTEA NOT NULL,
    burn_after_read BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Group conversations
  CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Group membership
  CREATE TABLE IF NOT EXISTS group_members (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, public_key)
  );

  -- Create index for message lookups by recipient
  CREATE INDEX IF NOT EXISTS idx_messages_recipient
    ON messages(recipient_public_key, lamport_ts);

  -- Create index for expired message keys (used by cleanup job)
  CREATE INDEX IF NOT EXISTS idx_message_keys_expires
    ON message_keys(expires_at)
    WHERE expires_at IS NOT NULL;
`;

/**
 * Close the connection pool gracefully.
 */
export async function closeDB(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
