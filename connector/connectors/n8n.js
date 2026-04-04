/**
 * connector/connectors/n8n.js
 *
 * n8n connector — connects to a self-hosted n8n instance via its REST API.
 */

import { BaseConnector } from "./base.js";

export class N8nConnector extends BaseConnector {
  /**
   * @param {{ url: string, apiKey: string, healthPath?: string }} config
   *   url      - e.g. "https://n8n.example.com"
   *   apiKey   - n8n API key (X-N8N-API-KEY)
   *   healthPath - path to ping (default "/healthz")
   */
  constructor(config) {
    if (!config?.url) throw new TypeError("N8nConnector requires config.url");
    if (!config?.apiKey) throw new TypeError("N8nConnector requires config.apiKey");
    super("n8n", "n8n Automation", "automation", {
      url: config.url.replace(/\/$/, ""),
      apiKey: config.apiKey,
      healthPath: config.healthPath ?? "/healthz",
    });
    this._fetch = config._fetch ?? fetch;
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
        headers: { "X-N8N-API-KEY": this.config.apiKey },
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

  /**
   * List workflows via the n8n REST API.
   *
   * @param {{ limit?: number, cursor?: string }} [opts]
   * @returns {Promise<{ data: unknown[], nextCursor?: string }>}
   */
  async listWorkflows({ limit = 25, cursor } = {}) {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (cursor) qs.set("cursor", cursor);
    const res = await this._fetch(`${this.config.url}/api/v1/workflows?${qs}`, {
      headers: { "X-N8N-API-KEY": this.config.apiKey },
    });
    if (!res.ok) throw new Error(`n8n API error: ${res.status}`);
    return res.json();
  }
}
