/**
 * connector/connectors/github.js
 *
 * GitHub connector — uses the GitHub REST API to verify connectivity and
 * provide repository/org metadata.
 */

import { BaseConnector } from "./base.js";

const GITHUB_API = "https://api.github.com";

export class GitHubConnector extends BaseConnector {
  /**
   * @param {{ token?: string, org?: string, healthPath?: string, _fetch?: typeof fetch }} [config]
   *   token    - Personal access token or fine-grained token (optional, raises rate limit)
   *   org      - Default organisation/user to scope requests (optional)
   *   healthPath - Health endpoint to ping (default "/")
   */
  constructor(config = {}) {
    super("github", "GitHub", "dev", {
      url: GITHUB_API,
      token: config.token ?? null,
      org: config.org ?? null,
      healthPath: config.healthPath ?? "/",
    });
    this._fetch = config._fetch ?? fetch;
  }

  #headers() {
    const h = {
      Accept: "application/vnd.github+json",
      "User-Agent": "OpenClaw-Connector/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (this.config.token) h["Authorization"] = `Bearer ${this.config.token}`;
    return h;
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
    const url = `${GITHUB_API}${this.config.healthPath}`;
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const res = await this._fetch(url, { headers: this.#headers(), signal: controller.signal });
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
   * List repositories for the configured org/user.
   *
   * @param {{ type?: string, per_page?: number }} [opts]
   * @returns {Promise<unknown[]>}
   */
  async listRepos({ type = "all", per_page = 30 } = {}) {
    if (!this.config.org) throw new Error("GitHubConnector: config.org is required for listRepos()");
    const qs = new URLSearchParams({ type, per_page: String(per_page) });
    const res = await this._fetch(`${GITHUB_API}/orgs/${this.config.org}/repos?${qs}`, {
      headers: this.#headers(),
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    return res.json();
  }
}
