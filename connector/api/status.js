/**
 * connector/api/status.js
 *
 * Dashboard Status API — returns a unified JSON snapshot of every
 * registered platform service. Can be called from an Express route,
 * a Supabase Edge Function, or any other HTTP handler.
 *
 * Usage:
 *
 *   import { createStatusHandler } from '@openclaw-hub/connector/api/status';
 *   import { registry }           from '@openclaw-hub/connector/registry';
 *
 *   const handler = createStatusHandler(registry);
 *
 *   // Express:
 *   app.get('/api/status', handler);
 *
 *   // Raw:
 *   const report = await handler();
 */

import { checkHealth } from "../health.js";

/**
 * @typedef {Object} StatusHandlerOptions
 * @property {number}  [timeoutMs=8000]  - Per-service ping timeout in ms
 * @property {string}  [version='1']     - API response version string
 * @property {typeof globalThis.fetch} [fetch] - Fetch implementation (injectable for tests)
 */

/**
 * Build a status handler bound to the given registry.
 *
 * The returned function accepts an optional Express-style `(req, res)` pair.
 * When called without arguments it returns the report object directly, so it
 * can be awaited in non-HTTP contexts (tests, scripts, Edge Functions).
 *
 * @param {import('../registry.js').ServiceRegistry} registry
 * @param {StatusHandlerOptions} [opts]
 * @returns {(req?: unknown, res?: { json: Function, status: Function, set?: Function }) => Promise<import('../health.js').HealthReport & { version: string }>}
 */
export function createStatusHandler(registry, opts = {}) {
  const { timeoutMs = 8_000, version = "1", fetch: fetchFn = fetch } = opts;

  return async function statusHandler(req, res) {
    const report = await checkHealth(registry, { timeoutMs, fetch: fetchFn });
    const payload = { version, ...report };

    // Express-compatible response
    if (res && typeof res.json === "function") {
      if (typeof res.set === "function") {
        res.set("Cache-Control", "no-store");
      }
      res.status(200).json(payload);
    }

    return payload;
  };
}

/**
 * Minimal standalone status check — registers the four core platform
 * services and runs a health check. Useful as a one-liner in scripts or
 * as a default export for a Supabase Edge Function.
 *
 * @param {{ supabaseUrl?: string, supabaseAnonKey?: string, n8nUrl?: string, n8nApiKey?: string, githubToken?: string, telegramBotToken?: string, _fetch?: typeof fetch }} [env]
 * @returns {Promise<import('../health.js').HealthReport & { version: string }>}
 */
export async function quickStatus(env = {}) {
  const { ServiceRegistry } = await import("../registry.js");
  const r = new ServiceRegistry();

  // Supabase
  if (env.supabaseUrl) {
    r.register({
      id: "supabase",
      name: "Supabase",
      url: env.supabaseUrl.replace(/\/$/, ""),
      type: "database",
      config: {
        healthPath: "/rest/v1/",
        anonKey: env.supabaseAnonKey ?? "",
      },
    });
  }

  // n8n
  if (env.n8nUrl) {
    r.register({
      id: "n8n",
      name: "n8n Automation",
      url: env.n8nUrl.replace(/\/$/, ""),
      type: "automation",
      config: { healthPath: "/healthz" },
    });
  }

  // GitHub
  r.register({
    id: "github",
    name: "GitHub",
    url: "https://api.github.com",
    type: "dev",
    config: { healthPath: "/" },
  });

  // Telegram (only if token provided)
  if (env.telegramBotToken) {
    r.register({
      id: "telegram",
      name: "Telegram Bot",
      url: "https://api.telegram.org",
      type: "messaging",
      config: { healthPath: `/bot${env.telegramBotToken}/getMe` },
    });
  }

  const fetchFn = env._fetch ?? fetch;
  const handler = createStatusHandler(r, { fetch: fetchFn });
  return handler();
}
