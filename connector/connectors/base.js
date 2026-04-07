/**
 * connector/connectors/base.js
 *
 * Abstract Connector Interface — every platform connector must extend this
 * class and implement the abstract methods below. The base class provides
 * lifecycle helpers and a consistent status surface.
 */

/** @typedef {'idle'|'connected'|'error'|'disconnected'} ConnectorState */

export class BaseConnector {
  /** @type {ConnectorState} */
  #state = "idle";

  /** @type {string | null} */
  #lastError = null;

  /** @type {string | null} */
  #connectedAt = null;

  /**
   * @param {string} id   - Unique connector id, e.g. "supabase"
   * @param {string} name - Human-readable name
   * @param {string} type - Service type (mirrors registry type)
   * @param {Record<string, unknown>} config - Connector-specific config
   */
  constructor(id, name, type, config = {}) {
    if (new.target === BaseConnector) {
      throw new TypeError("BaseConnector is abstract and cannot be instantiated directly.");
    }
    if (!id) throw new TypeError("id is required");
    if (!name) throw new TypeError("name is required");
    if (!type) throw new TypeError("type is required");

    this.id = id;
    this.name = name;
    this.type = type;
    this.config = config;
  }

  // ─── State helpers ──────────────────────────────────────────────────────────

  get state() { return this.#state; }
  get isConnected() { return this.#state === "connected"; }
  get lastError() { return this.#lastError; }
  get connectedAt() { return this.#connectedAt; }

  _setState(state, error = null) {
    this.#state = state;
    this.#lastError = error;
    if (state === "connected") this.#connectedAt = new Date().toISOString();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Establish the connection. Implementations should call `_setState('connected')`
   * on success or `_setState('error', message)` on failure.
   *
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error(`${this.constructor.name}.connect() is not implemented`);
  }

  /**
   * Tear down the connection gracefully.
   *
   * @returns {Promise<void>}
   */
  async disconnect() {
    this._setState("disconnected");
  }

  /**
   * Perform a lightweight health-check against the remote service.
   * Must return a result compatible with ServiceHealth (status, latency_ms, etc.).
   *
   * @returns {Promise<{ status: 'online'|'degraded'|'offline', latency_ms: number|null, status_code: number|null, error?: string }>}
   */
  async ping() {
    throw new Error(`${this.constructor.name}.ping() is not implemented`);
  }

  /**
   * Return connector metadata for use in the dashboard and registry.
   *
   * @returns {{ id: string, name: string, type: string, url: string, state: ConnectorState, connectedAt: string|null, config: Record<string,unknown> }}
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      url: this.config.url ?? "",
      state: this.#state,
      connectedAt: this.#connectedAt,
      config: this._safeConfig(),
    };
  }

  /**
   * Return a redacted copy of config (strips secrets like api keys and tokens).
   * Secret values are replaced with a masked hint showing only the last 4
   * characters (e.g. "****cret") so the entry is identifiable but never
   * exposes the full secret.
   * Override in subclasses to customise.
   *
   * @returns {Record<string, unknown>}
   */
  _safeConfig() {
    const safe = {};
    const secretKeys = /key|token|secret|password|pass|credential|auth/i;
    for (const [k, v] of Object.entries(this.config)) {
      if (secretKeys.test(k)) {
        safe[k] = typeof v === "string" && v.length > 4
          ? `****${v.slice(-4)}`
          : "[REDACTED]";
      } else {
        safe[k] = v;
      }
    }
    return safe;
  }

  /**
   * Register this connector's service entry into a ServiceRegistry.
   * Only the safe (masked) config is stored — raw secrets never enter the
   * registry.
   *
   * @param {import('../registry.js').ServiceRegistry} registry
   */
  registerWith(registry) {
    registry.upsert({
      id: this.id,
      name: this.name,
      url: this.config.url ?? "",
      type: this.type,
      config: this._safeConfig(),
    });
  }
}
