/**
 * Security headers middleware for PhantomChat.
 *
 * These headers implement defence-in-depth at the HTTP level:
 *
 * - Content-Security-Policy: Restricts which resources the browser can load.
 *   script-src 'self' ensures only our own scripts run (with SRI hashes).
 *
 * - Strict-Transport-Security: Forces HTTPS for 2 years, including subdomains.
 *   The 'preload' directive allows inclusion in browser HSTS preload lists.
 *
 * - X-Content-Type-Options: Prevents MIME-type sniffing attacks.
 *
 * - Permissions-Policy: Disables camera, microphone, and geolocation APIs
 *   since PhantomChat doesn't need them. Reduces attack surface.
 *
 * - X-Frame-Options: Prevents clickjacking by disabling iframe embedding.
 *
 * - Referrer-Policy: Prevents leaking URLs in the Referer header.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Fastify onSend hook that injects security headers into every response.
 */
export async function securityHeaders(
  _request: FastifyRequest,
  reply: FastifyReply,
  _payload: unknown
): Promise<void> {
  // Content Security Policy
  // 'self' allows scripts and styles only from our own origin.
  // In production, add specific SRI sha384-... hashes for inline scripts.
  reply.header(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'", // SRI hashes added by Vite build
      "style-src 'self' 'unsafe-inline'", // Tailwind needs inline styles
      "img-src 'self' blob: data:",
      "connect-src 'self' ws: wss:",
      "font-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  // HSTS: 2 years, include subdomains, eligible for preload
  reply.header(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );

  // Prevent MIME-type sniffing
  reply.header('X-Content-Type-Options', 'nosniff');

  // Disable unnecessary browser features
  reply.header(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  // Prevent clickjacking
  reply.header('X-Frame-Options', 'DENY');

  // Don't leak referrer information
  reply.header('Referrer-Policy', 'no-referrer');

  // Prevent caching of sensitive responses
  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  reply.header('Pragma', 'no-cache');
}
