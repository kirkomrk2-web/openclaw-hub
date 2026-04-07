/**
 * connector/tests/connectors.test.js
 *
 * Tests for BaseConnector and all four connector implementations.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BaseConnector } from "../connectors/base.js";
import { SupabaseConnector } from "../connectors/supabase.js";
import { N8nConnector } from "../connectors/n8n.js";
import { GitHubConnector } from "../connectors/github.js";
import { TelegramConnector } from "../connectors/telegram.js";
import { ServiceRegistry } from "../registry.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

function mockFetch(status = 200) {
  return async () => ({ status, headers: { get: () => "application/json" }, ok: status < 400, json: async () => ({}), text: async () => "" });
}

function errorFetch(msg = "ECONNREFUSED") {
  return async () => { throw new Error(msg); };
}

// ── BaseConnector ──────────────────────────────────────────────────────────────

describe("BaseConnector", () => {
  it("cannot be instantiated directly", () => {
    assert.throws(() => new BaseConnector("x", "X", "dev", {}), TypeError);
  });

  it("subclass without connect() throws on connect()", async () => {
    class MyConnector extends BaseConnector {}
    const c = new MyConnector("my", "My", "dev", { url: "https://my.com" });
    await assert.rejects(() => c.connect(), /not implemented/);
  });

  it("subclass without ping() throws on ping()", async () => {
    class MyConnector extends BaseConnector {}
    const c = new MyConnector("my", "My", "dev", { url: "https://my.com" });
    await assert.rejects(() => c.ping(), /not implemented/);
  });

  it("getInfo() masks secret keys in config with last-4 hint", () => {
    class MyConnector extends BaseConnector {
      async connect() { this._setState("connected"); }
      async ping() { return { status: "online", latency_ms: 1, status_code: 200 }; }
    }
    const c = new MyConnector("my", "My", "dev", {
      url: "https://my.com",
      apiKey: "super-secret",
      token: "another-secret",
      shortKey: "abc",
      publicField: "visible",
    });
    const info = c.getInfo();
    assert.equal(info.config.apiKey, "****cret");
    assert.equal(info.config.token, "****cret");
    assert.equal(info.config.shortKey, "[REDACTED]");
    assert.equal(info.config.publicField, "visible");
  });

  it("registerWith() upserts into a registry", () => {
    class MyConnector extends BaseConnector {
      async connect() {}
      async ping() { return { status: "online", latency_ms: 1, status_code: 200 }; }
    }
    const c = new MyConnector("my", "My", "dev", { url: "https://my.com" });
    const reg = new ServiceRegistry();
    c.registerWith(reg);
    assert.ok(reg.has("my"));
  });

  it("registerWith() stores masked config — no raw secrets in registry", () => {
    class MyConnector extends BaseConnector {
      async connect() {}
      async ping() { return { status: "online", latency_ms: 1, status_code: 200 }; }
    }
    const rawSecret = "my-super-secret-api-key";
    const c = new MyConnector("my", "My", "dev", {
      url: "https://my.com",
      apiKey: rawSecret,
      token: "tok-abcd",
      shortKey: "abc",
    });
    const reg = new ServiceRegistry();
    c.registerWith(reg);
    const entry = reg.get("my");
    assert.ok(entry, "entry should exist in registry");
    assert.notEqual(entry.config.apiKey, rawSecret, "raw apiKey must not be stored");
    assert.notEqual(entry.config.token, "tok-abcd", "raw token must not be stored");
    assert.equal(entry.config.apiKey, "****-key", "apiKey should show last-4 mask");
    assert.equal(entry.config.token, "****abcd", "token should show last-4 mask");
    assert.equal(entry.config.shortKey, "[REDACTED]", "short secrets (≤4 chars) must be fully redacted");
  });

  it("disconnect() sets state to disconnected", async () => {
    class MyConnector extends BaseConnector {
      async connect() { this._setState("connected"); }
      async ping() { return { status: "online", latency_ms: 1, status_code: 200 }; }
    }
    const c = new MyConnector("my", "My", "dev", { url: "https://my.com" });
    await c.connect();
    assert.equal(c.state, "connected");
    await c.disconnect();
    assert.equal(c.state, "disconnected");
  });
});

// ── SupabaseConnector ──────────────────────────────────────────────────────────

describe("SupabaseConnector", () => {
  it("throws without url", () => {
    assert.throws(() => new SupabaseConnector({ anonKey: "k" }), TypeError);
  });

  it("throws without anonKey", () => {
    assert.throws(() => new SupabaseConnector({ url: "https://x.supabase.co" }), TypeError);
  });

  it("ping() returns online for 200", async () => {
    const c = new SupabaseConnector({ url: "https://x.supabase.co", anonKey: "k", _fetch: mockFetch(200) });
    const r = await c.ping();
    assert.equal(r.status, "online");
    assert.equal(r.status_code, 200);
  });

  it("ping() returns degraded for 5xx", async () => {
    const c = new SupabaseConnector({ url: "https://x.supabase.co", anonKey: "k", _fetch: mockFetch(503) });
    const r = await c.ping();
    assert.equal(r.status, "degraded");
  });

  it("ping() returns offline on network error", async () => {
    const c = new SupabaseConnector({ url: "https://x.supabase.co", anonKey: "k", _fetch: errorFetch() });
    const r = await c.ping();
    assert.equal(r.status, "offline");
    assert.ok(r.error);
  });

  it("connect() sets state to connected on success", async () => {
    const c = new SupabaseConnector({ url: "https://x.supabase.co", anonKey: "k", _fetch: mockFetch(200) });
    await c.connect();
    assert.equal(c.state, "connected");
  });

  it("connect() sets state to error on failure", async () => {
    const c = new SupabaseConnector({ url: "https://x.supabase.co", anonKey: "k", _fetch: errorFetch() });
    await c.connect();
    assert.equal(c.state, "error");
  });
});

// ── N8nConnector ──────────────────────────────────────────────────────────────

describe("N8nConnector", () => {
  it("throws without url", () => {
    assert.throws(() => new N8nConnector({ apiKey: "k" }), TypeError);
  });

  it("throws without apiKey", () => {
    assert.throws(() => new N8nConnector({ url: "https://n8n.example.com" }), TypeError);
  });

  it("ping() returns online for 200", async () => {
    const c = new N8nConnector({ url: "https://n8n.example.com", apiKey: "k", _fetch: mockFetch(200) });
    const r = await c.ping();
    assert.equal(r.status, "online");
  });

  it("ping() returns offline on error", async () => {
    const c = new N8nConnector({ url: "https://n8n.example.com", apiKey: "k", _fetch: errorFetch() });
    const r = await c.ping();
    assert.equal(r.status, "offline");
  });

  it("listWorkflows() calls /api/v1/workflows", async () => {
    let calledUrl = "";
    const cap = async (url) => { calledUrl = url; return { ok: true, json: async () => ({ data: [] }) }; };
    const c = new N8nConnector({ url: "https://n8n.example.com", apiKey: "k", _fetch: cap });
    await c.listWorkflows();
    assert.ok(calledUrl.includes("/api/v1/workflows"), `Expected /api/v1/workflows in URL, got ${calledUrl}`);
  });

  it("listWorkflows() throws on non-ok response", async () => {
    const c = new N8nConnector({ url: "https://n8n.example.com", apiKey: "k", _fetch: mockFetch(401) });
    await assert.rejects(() => c.listWorkflows(), /n8n API error/);
  });
});

// ── GitHubConnector ───────────────────────────────────────────────────────────

describe("GitHubConnector", () => {
  it("creates with no config", () => {
    const c = new GitHubConnector();
    assert.equal(c.id, "github");
    assert.equal(c.type, "dev");
  });

  it("ping() returns online for 200", async () => {
    const c = new GitHubConnector({ _fetch: mockFetch(200) });
    const r = await c.ping();
    assert.equal(r.status, "online");
  });

  it("ping() returns offline on error", async () => {
    const c = new GitHubConnector({ _fetch: errorFetch() });
    const r = await c.ping();
    assert.equal(r.status, "offline");
  });

  it("listRepos() throws without org", async () => {
    const c = new GitHubConnector({ _fetch: mockFetch(200) });
    await assert.rejects(() => c.listRepos(), /org is required/);
  });

  it("listRepos() calls GitHub orgs endpoint", async () => {
    let calledUrl = "";
    const cap = async (url) => { calledUrl = url; return { ok: true, json: async () => [] }; };
    const c = new GitHubConnector({ org: "kirkomrk2-web", _fetch: cap });
    await c.listRepos();
    assert.ok(calledUrl.includes("/orgs/kirkomrk2-web/repos"), `Expected orgs endpoint, got ${calledUrl}`);
  });

  it("listRepos() throws on non-ok response", async () => {
    const c = new GitHubConnector({ org: "kirkomrk2-web", _fetch: mockFetch(403) });
    await assert.rejects(() => c.listRepos(), /GitHub API error/);
  });
});

// ── TelegramConnector ─────────────────────────────────────────────────────────

describe("TelegramConnector", () => {
  it("throws without botToken", () => {
    assert.throws(() => new TelegramConnector({}), TypeError);
  });

  it("ping() returns online for 200", async () => {
    const c = new TelegramConnector({ botToken: "123:ABC", _fetch: mockFetch(200) });
    const r = await c.ping();
    assert.equal(r.status, "online");
  });

  it("ping() returns offline on network error", async () => {
    const c = new TelegramConnector({ botToken: "123:ABC", _fetch: errorFetch() });
    const r = await c.ping();
    assert.equal(r.status, "offline");
  });

  it("sendMessage() throws without chatId", async () => {
    const c = new TelegramConnector({ botToken: "123:ABC", _fetch: mockFetch(200) });
    await assert.rejects(() => c.sendMessage("hello"), /chatId is required/);
  });

  it("sendMessage() POSTs to sendMessage endpoint", async () => {
    let calledUrl = "";
    let calledBody = "";
    const cap = async (url, opts) => {
      calledUrl = url;
      calledBody = opts?.body ?? "";
      return { ok: true, json: async () => ({ ok: true }) };
    };
    const c = new TelegramConnector({ botToken: "123:ABC", chatId: "-100", _fetch: cap });
    await c.sendMessage("Hello Hub!");
    assert.ok(calledUrl.includes("sendMessage"), `Expected sendMessage endpoint, got ${calledUrl}`);
    assert.ok(calledBody.includes("Hello Hub!"), "Body should contain the message text");
  });

  it("sendMessage() throws on API error", async () => {
    const cap = async () => ({ ok: false, status: 400, text: async () => "Bad Request" });
    const c = new TelegramConnector({ botToken: "123:ABC", chatId: "-100", _fetch: cap });
    await assert.rejects(() => c.sendMessage("boom"), /Telegram API error/);
  });
});
