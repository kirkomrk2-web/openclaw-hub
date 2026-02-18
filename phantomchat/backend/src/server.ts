/**
 * PhantomChat Backend — Fastify Server
 *
 * ZERO-KNOWLEDGE design: the server sees ONLY:
 *   - Encrypted blobs (ciphertext)
 *   - UUIDs (message IDs, user IDs)
 *   - TTL timestamps (for self-destruct key expiry)
 *   - Public keys (X25519)
 *
 * The server NEVER sees:
 *   - Plaintext messages
 *   - Private keys
 *   - IP addresses (not logged)
 *   - User agents (not logged)
 *   - Timing metadata
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { messageRoutes } from './routes/messages.js';
import { authRoutes } from './routes/auth.js';
import { keyRoutes } from './routes/keys.js';
import { securityHeaders } from './middleware/security-headers.js';
import { initDB } from './db/connection.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const app = Fastify({
    logger: {
      level: 'info',
      // SECURITY: Do NOT log request details that could identify users
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            // Deliberately omitting: headers, hostname, remoteAddress, remotePort
          };
        },
        res(reply) {
          return {
            statusCode: reply.statusCode,
          };
        },
      },
    },
    // Disable trust proxy to prevent IP header spoofing
    trustProxy: false,
  });

  // ─── Plugins ───

  await app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // We set CSP manually in security-headers
  });

  // Rate limiting: 10 requests/second per IP
  await app.register(rateLimit, {
    max: 10,
    timeWindow: '1 second',
    // Exponential backoff on auth failures is handled in the auth route
  });

  await app.register(websocket);

  // ─── Security Headers ───
  app.addHook('onSend', securityHeaders);

  // ─── Database ───
  await initDB();

  // ─── Routes ───
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(messageRoutes, { prefix: '/api/messages' });
  await app.register(keyRoutes, { prefix: '/api/keys' });

  // ─── Health Check ───
  app.get('/api/health', async () => ({
    status: 'ok',
    timestamp: Date.now(),
  }));

  // ─── Start ───
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`PhantomChat server running on ${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
