/**
 * connector/connectors/supabase.js
 *
 * Supabase connector — wraps the Supabase REST API.
 * Pings the REST endpoint to verify the project is reachable and the
 * anon key is accepted.
 */

import { BaseConnector } from "./base.js";

export class SupabaseConnector extends BaseConnector {
  /**
   * @param {{ url: string, anonKey: string, healthPath?: string }} config
   *   url       - e.g. "https://xyzxyz.supabase.co"
   *   anonKey   - Supabase anon/public API key
   *   healthPath - path to ping (default "/rest/v1/")
   */
  constructor(config) {
    if (!config?.url) throw new TypeError("SupabaseConnector requires config.url");
    if (!config?.anonKey) throw new TypeError("SupabaseConnector requires config.anonKey");
    super("supabase", "Supabase", "database", {
      url: config.url.replace(/\/$/, ""),
      anonKey: config.anonKey,
      healthPath: config.healthPath ?? "/rest/v1/",
    });
    this._fetch = config._fetch ?? fetch; // injectable for tests
  }

  async connect() {
    try {
      const result = await this.ping();
      if (result.status === "offline") {
        this._setState("error", result.error ?? "Unreachable");
      } else {
        this._setState("connected");
      }
    } catch (err) {
      this._setState("error", err.message);
      throw err;
    }
  }

  async ping() {
    const url = `${this.config.url}${this.config.healthPath}`;
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const res = await this._fetch(url, {
        headers: {
          apikey: this.config.anonKey,
          Authorization: `Bearer ${this.config.anonKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const latency = Date.now() - start;
      return {
        status: res.status < 500 ? (latency >= 3_000 ? "degraded" : "online") : "degraded",
        latency_ms: latency,
        status_code: res.status,
      };
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      return {
        status: "offline",
        latency_ms: isTimeout ? 8_000 : Date.now() - start,
        status_code: null,
        error: isTimeout ? "Request timed out (8000ms)" : err.message,
      };
    }
  }
}
