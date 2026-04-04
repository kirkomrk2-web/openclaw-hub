/**
 * connector/tests/registry.test.js
 */

import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ServiceRegistry, registry } from "../registry.js";

describe("ServiceRegistry", () => {
  let reg;

  beforeEach(() => {
    reg = new ServiceRegistry();
  });

  it("registers a valid service", () => {
    const entry = reg.register({ id: "gh", name: "GitHub", url: "https://api.github.com", type: "dev" });
    assert.equal(entry.id, "gh");
    assert.equal(entry.name, "GitHub");
    assert.ok(entry.registeredAt, "registeredAt should be set");
    assert.equal(reg.size, 1);
  });

  it("throws when id is missing", () => {
    assert.throws(() => reg.register({ name: "X", url: "https://x.com", type: "dev" }), TypeError);
  });

  it("throws when name is missing", () => {
    assert.throws(() => reg.register({ id: "x", url: "https://x.com", type: "dev" }), TypeError);
  });

  it("throws when url is missing", () => {
    assert.throws(() => reg.register({ id: "x", name: "X", type: "dev" }), TypeError);
  });

  it("throws when type is missing", () => {
    assert.throws(() => reg.register({ id: "x", name: "X", url: "https://x.com" }), TypeError);
  });

  it("throws on duplicate registration", () => {
    reg.register({ id: "gh", name: "GitHub", url: "https://api.github.com", type: "dev" });
    assert.throws(() => reg.register({ id: "gh", name: "GitHub2", url: "https://api.github.com", type: "dev" }), /already registered/);
  });

  it("update() patches an existing service", () => {
    reg.register({ id: "gh", name: "GitHub", url: "https://api.github.com", type: "dev" });
    const updated = reg.update("gh", { name: "GitHub v2" });
    assert.equal(updated.name, "GitHub v2");
    assert.equal(updated.id, "gh");
  });

  it("update() throws for unknown id", () => {
    assert.throws(() => reg.update("ghost", { name: "X" }), /not registered/);
  });

  it("upsert() registers a new service", () => {
    const entry = reg.upsert({ id: "supa", name: "Supabase", url: "https://x.supabase.co", type: "database" });
    assert.equal(reg.size, 1);
    assert.equal(entry.id, "supa");
  });

  it("upsert() updates an existing service", () => {
    reg.register({ id: "supa", name: "Supabase", url: "https://x.supabase.co", type: "database" });
    const entry = reg.upsert({ id: "supa", name: "Supabase v2", url: "https://x.supabase.co", type: "database" });
    assert.equal(entry.name, "Supabase v2");
    assert.equal(reg.size, 1);
  });

  it("deregister() removes a service", () => {
    reg.register({ id: "gh", name: "GitHub", url: "https://api.github.com", type: "dev" });
    const removed = reg.deregister("gh");
    assert.ok(removed);
    assert.equal(reg.size, 0);
  });

  it("deregister() returns false for unknown id", () => {
    assert.equal(reg.deregister("ghost"), false);
  });

  it("get() returns the service entry", () => {
    reg.register({ id: "gh", name: "GitHub", url: "https://api.github.com", type: "dev" });
    const entry = reg.get("gh");
    assert.equal(entry.id, "gh");
  });

  it("has() returns true for registered ids", () => {
    reg.register({ id: "gh", name: "GitHub", url: "https://api.github.com", type: "dev" });
    assert.ok(reg.has("gh"));
    assert.ok(!reg.has("ghost"));
  });

  it("list() returns all services", () => {
    reg.register({ id: "gh", name: "GitHub", url: "https://api.github.com", type: "dev" });
    reg.register({ id: "supa", name: "Supabase", url: "https://x.supabase.co", type: "database" });
    assert.equal(reg.list().length, 2);
  });

  it("list({ type }) filters by type", () => {
    reg.register({ id: "gh", name: "GitHub", url: "https://api.github.com", type: "dev" });
    reg.register({ id: "supa", name: "Supabase", url: "https://x.supabase.co", type: "database" });
    const devs = reg.list({ type: "dev" });
    assert.equal(devs.length, 1);
    assert.equal(devs[0].id, "gh");
  });

  it("discover() filters by predicate", () => {
    reg.register({ id: "gh", name: "GitHub", url: "https://api.github.com", type: "dev" });
    reg.register({ id: "supa", name: "Supabase", url: "https://x.supabase.co", type: "database" });
    const found = reg.discover((s) => s.name.startsWith("Git"));
    assert.equal(found.length, 1);
    assert.equal(found[0].id, "gh");
  });

  it("clear() empties the registry", () => {
    reg.register({ id: "gh", name: "GitHub", url: "https://api.github.com", type: "dev" });
    reg.clear();
    assert.equal(reg.size, 0);
  });

  it("exports a default singleton registry", () => {
    assert.ok(registry instanceof ServiceRegistry);
  });
});
