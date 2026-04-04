/**
 * connector/health.js
 *
 * Health Check Aggregator — pings every service registered in a
 * ServiceRegistry and returns a unified status report.
 */

/** @typedef {'online'|'degraded'|'offline'} HealthStatus */

/**
 * @typedef {Object} ServiceHealth
 * @property {string}       id
 * @property {string}       name
 * @property {string}       url
 * @property {string}       type
 * @property {HealthStatus} status
 * @property {number|null}  latency_ms
 * @property {number|null}  status_code
 * @property {string}       checked_at
 * @property {string}       [error]
 */

/**
 * @typedef {Object} HealthReport
 * @property {ServiceHealth[]} services
 * @property {{ total: number, online: number, degraded: number, offline: number, avg_latency_ms: number, overall_status: string }} summary
 * @property {string} checked_at
 */

const DEFAULT_TIMEOUT_MS = 8_000;
const DEGRADED_LATENCY_MS = 3_000;

/**
 * Ping a single service URL and return its health result.
 *
 * @param {{ id: string, name: string, url: string, type: string, config?: Record<string, unknown> }} service
 * @param {{ timeoutMs?: number, fetch?: typeof globalThis.fetch }} [opts]
 * @returns {Promise<ServiceHealth>}
 */
export async function pingService(service, { timeoutMs = DEFAULT_TIMEOUT_MS, fetch: fetchFn = fetch } = {}) {
  const healthPath = service.config?.healthPath ?? "/";
  const pingUrl = `${service.url}${healthPath}`;
  const checkedAt = new Date().toISOString();
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetchFn(pingUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "OpenClaw-Connector/1.0" },
    });
    clearTimeout(timer);

    const latency = Date.now() - start;
    const ok = res.status < 500;

    return {
      id: service.id,
      name: service.name,
      url: service.url,
      type: service.type,
      status: ok ? (latency >= DEGRADED_LATENCY_MS ? "degraded" : "online") : "degraded",
      latency_ms: latency,
      status_code: res.status,
      checked_at: checkedAt,
    };
  } catch (err) {
    const latency = Date.now() - start;
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return {
      id: service.id,
      name: service.name,
      url: service.url,
      type: service.type,
      status: "offline",
      latency_ms: isTimeout ? timeoutMs : latency,
      status_code: null,
      checked_at: checkedAt,
      error: isTimeout ? `Request timed out (${timeoutMs}ms)` : (err instanceof Error ? err.message : "Unknown error"),
    };
  }
}

/**
 * Aggregate health across all services in the given registry.
 *
 * @param {import('./registry.js').ServiceRegistry} registry
 * @param {{ timeoutMs?: number, filter?: (s: import('./registry.js').ServiceEntry) => boolean, fetch?: typeof globalThis.fetch }} [opts]
 * @returns {Promise<HealthReport>}
 */
export async function checkHealth(registry, { timeoutMs = DEFAULT_TIMEOUT_MS, filter, fetch: fetchFn = fetch } = {}) {
  let services = registry.list();
  if (filter) services = services.filter(filter);

  const results = await Promise.all(
    services.map((s) => pingService(s, { timeoutMs, fetch: fetchFn }))
  );

  const online = results.filter((r) => r.status === "online").length;
  const degraded = results.filter((r) => r.status === "degraded").length;
  const offline = results.filter((r) => r.status === "offline").length;

  const activeSamples = results.filter((r) => r.latency_ms !== null && r.status !== "offline");
  const avgLatency =
    activeSamples.length > 0
      ? Math.round(activeSamples.reduce((sum, r) => sum + (r.latency_ms ?? 0), 0) / activeSamples.length)
      : 0;

  let overallStatus = "healthy";
  if (offline > 0) overallStatus = "degraded";
  else if (degraded > 0) overallStatus = "warning";

  return {
    services: results,
    summary: {
      total: results.length,
      online,
      degraded,
      offline,
      avg_latency_ms: avgLatency,
      overall_status: overallStatus,
    },
    checked_at: new Date().toISOString(),
  };
}
