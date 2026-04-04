/**
 * connector/registry.js
 *
 * Service Registry — central catalogue for all platform services connected
 * to the OpenClaw Hub. Services register themselves (or are registered by
 * their connector) so the health aggregator and dashboard API can discover
 * them without hard-coding a list.
 */

/**
 * @typedef {Object} ServiceEntry
 * @property {string}   id         - Unique service identifier (e.g. "supabase", "n8n")
 * @property {string}   name       - Human-readable display name
 * @property {string}   url        - Base URL used to reach the service
 * @property {string}   type       - Service category: "database"|"automation"|"dev"|"messaging"|"ai"|"hosting"
 * @property {Object}   [config]   - Connector-specific configuration (keys, paths, etc.)
 * @property {string}   registeredAt - ISO timestamp of when the service was registered
 */

export class ServiceRegistry {
  /** @type {Map<string, ServiceEntry>} */
  #services = new Map();

  /**
   * Register a platform service.
   *
   * @param {Omit<ServiceEntry, 'registeredAt'>} entry
   * @returns {ServiceEntry} The stored entry
   * @throws {TypeError} If required fields are missing or id already exists
   */
  register(entry) {
    if (!entry || typeof entry !== "object") {
      throw new TypeError("entry must be an object");
    }
    const { id, name, url, type } = entry;
    if (!id || typeof id !== "string") throw new TypeError("entry.id must be a non-empty string");
    if (!name || typeof name !== "string") throw new TypeError("entry.name must be a non-empty string");
    if (!url || typeof url !== "string") throw new TypeError("entry.url must be a non-empty string");
    if (!type || typeof type !== "string") throw new TypeError("entry.type must be a non-empty string");
    if (this.#services.has(id)) {
      throw new Error(`Service '${id}' is already registered. Call update() to modify it.`);
    }

    const stored = { ...entry, registeredAt: new Date().toISOString() };
    this.#services.set(id, stored);
    return stored;
  }

  /**
   * Update an already-registered service (partial update, id unchanged).
   *
   * @param {string} id
   * @param {Partial<Omit<ServiceEntry, 'id' | 'registeredAt'>>} patch
   * @returns {ServiceEntry} The updated entry
   */
  update(id, patch) {
    const existing = this.#services.get(id);
    if (!existing) throw new Error(`Service '${id}' is not registered.`);
    const updated = { ...existing, ...patch, id, registeredAt: existing.registeredAt };
    this.#services.set(id, updated);
    return updated;
  }

  /**
   * Register a service, replacing it if it already exists.
   *
   * @param {Omit<ServiceEntry, 'registeredAt'>} entry
   * @returns {ServiceEntry}
   */
  upsert(entry) {
    if (this.#services.has(entry.id)) {
      const { id, ...patch } = entry;
      return this.update(id, patch);
    }
    return this.register(entry);
  }

  /**
   * Remove a service from the registry.
   *
   * @param {string} id
   * @returns {boolean} true if removed, false if not found
   */
  deregister(id) {
    return this.#services.delete(id);
  }

  /**
   * Get a single service by id.
   *
   * @param {string} id
   * @returns {ServiceEntry | undefined}
   */
  get(id) {
    return this.#services.get(id);
  }

  /**
   * Check whether a service is registered.
   *
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return this.#services.has(id);
  }

  /**
   * Return all registered services, optionally filtered by type.
   *
   * @param {{ type?: string }} [filter]
   * @returns {ServiceEntry[]}
   */
  list({ type } = {}) {
    const all = Array.from(this.#services.values());
    return type ? all.filter((s) => s.type === type) : all;
  }

  /**
   * Discover services that match a predicate.
   *
   * @param {(entry: ServiceEntry) => boolean} predicate
   * @returns {ServiceEntry[]}
   */
  discover(predicate) {
    return this.list().filter(predicate);
  }

  /** @returns {number} Total number of registered services */
  get size() {
    return this.#services.size;
  }

  /** Clear all registrations (useful in tests). */
  clear() {
    this.#services.clear();
  }
}

// Default shared registry instance
export const registry = new ServiceRegistry();
