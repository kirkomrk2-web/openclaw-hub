/**
 * connector/tests/status.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ServiceRegistry } from "../registry.js";
import { createStatusHandler, quickStatus } from "../api/status.js";

function mockFetch(status = 200) {
  return async () => ({ status, headers: { get: () => null } });
}

function errorFetch() {
  return async () => { throw new Error("ECONNREFUSED"); };
}

describe("createStatusHandler", () => {
  it("returns a function", () => {
    const reg = new ServiceRegistry();
    const handler = createStatusHandler(reg);
    assert.equal(typeof handler, "function");
  });

  it("returns a report with version field", async () => {
    const reg = new ServiceRegistry();
    const handler = createStatusHandler(reg, { fetch: mockFetch(200) });
    const report = await handler();
    assert.ok(report.version, "report should have a version field");
    assert.ok(report.summary, "report should have summary");
    assert.ok(report.checked_at, "report should have checked_at");
  });

  it("report reflects registered services", async () => {
    const reg = new ServiceRegistry();
    reg.register({ id: "gh", name: "GitHub", url: "https://api.github.com", type: "dev" });
    const handler = createStatusHandler(reg, { fetch: mockFetch(200) });
    const report = await handler();
    assert.equal(report.summary.total, 1);
    assert.equal(report.services[0].id, "gh");
  });

  it("calls res.json() when Express-style res is provided", async () => {
    const reg = new ServiceRegistry();
    const handler = createStatusHandler(reg, { fetch: mockFetch(200) });

    let jsonPayload = null;
    let statusCode = null;
    const mockRes = {
      json: (payload) => { jsonPayload = payload; },
      status: (code) => { statusCode = code; return mockRes; },
      set: () => {},
    };

    await handler(null, mockRes);
    assert.equal(statusCode, 200);
    assert.ok(jsonPayload, "json should have been called");
    assert.ok(jsonPayload.summary);
  });

  it("overall_status is degraded when services are offline", async () => {
    const reg = new ServiceRegistry();
    reg.register({ id: "dead", name: "Dead", url: "https://dead.example.com", type: "dev" });
    const handler = createStatusHandler(reg, { fetch: errorFetch() });
    const report = await handler();
    assert.equal(report.summary.overall_status, "degraded");
    assert.equal(report.summary.offline, 1);
  });

  it("respects custom version option", async () => {
    const reg = new ServiceRegistry();
    const handler = createStatusHandler(reg, { version: "42", fetch: mockFetch(200) });
    const report = await handler();
    assert.equal(report.version, "42");
  });
});

describe("quickStatus", () => {
  it("returns a report with default (GitHub) service", async () => {
    const report = await quickStatus({ _fetch: mockFetch(200) });
    assert.ok(report.summary.total >= 1, "should include at least GitHub");
    const ghService = report.services.find((s) => s.id === "github");
    assert.ok(ghService, "GitHub service should be present");
  });

  it("includes supabase when supabaseUrl is provided", async () => {
    const report = await quickStatus({
      supabaseUrl: "https://xyzxyz.supabase.co",
      supabaseAnonKey: "anon",
      _fetch: mockFetch(200),
    });
    const supa = report.services.find((s) => s.id === "supabase");
    assert.ok(supa, "Supabase service should be present");
  });

  it("includes n8n when n8nUrl is provided", async () => {
    const report = await quickStatus({
      n8nUrl: "https://n8n.example.com",
      _fetch: mockFetch(200),
    });
    const n8n = report.services.find((s) => s.id === "n8n");
    assert.ok(n8n, "n8n service should be present");
  });

  it("includes telegram when telegramBotToken is provided", async () => {
    const report = await quickStatus({
      telegramBotToken: "123:ABC",
      _fetch: mockFetch(200),
    });
    const tg = report.services.find((s) => s.id === "telegram");
    assert.ok(tg, "Telegram service should be present");
  });

  it("omits optional services when not configured", async () => {
    const report = await quickStatus({ _fetch: mockFetch(200) });
    assert.ok(!report.services.find((s) => s.id === "supabase"), "Supabase should be absent");
    assert.ok(!report.services.find((s) => s.id === "n8n"), "n8n should be absent");
    assert.ok(!report.services.find((s) => s.id === "telegram"), "Telegram should be absent");
  });
});
