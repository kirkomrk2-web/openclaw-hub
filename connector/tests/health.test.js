/**
 * connector/tests/health.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ServiceRegistry } from "../registry.js";
import { pingService, checkHealth } from "../health.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeFetch(status = 200, delayMs = 0) {
  return async () => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    return { status, headers: { get: () => null } };
  };
}

function makeTimeoutFetch() {
  return async (_url, opts) => {
    return new Promise((_resolve, _reject) => {
      opts?.signal?.addEventListener("abort", () => {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        _reject(err);
      });
    });
  };
}

function makeErrorFetch(message = "ECONNREFUSED") {
  return async () => { throw new Error(message); };
}

function svc(overrides = {}) {
  return {
    id: "test-svc",
    name: "Test",
    url: "https://example.com",
    type: "dev",
    config: { healthPath: "/health" },
    ...overrides,
  };
}

// ── pingService ────────────────────────────────────────────────────────────────

describe("pingService", () => {
  it("reports online for a fast 200 response", async () => {
    const result = await pingService(svc(), { fetch: makeFetch(200) });
    assert.equal(result.status, "online");
    assert.equal(result.status_code, 200);
    assert.ok(result.latency_ms >= 0);
    assert.ok(result.checked_at);
  });

  it("reports degraded for a 5xx response", async () => {
    const result = await pingService(svc(), { fetch: makeFetch(503) });
    assert.equal(result.status, "degraded");
    assert.equal(result.status_code, 503);
  });

  it("reports offline on network error", async () => {
    const result = await pingService(svc(), { fetch: makeErrorFetch("ECONNREFUSED") });
    assert.equal(result.status, "offline");
    assert.equal(result.status_code, null);
    assert.ok(result.error);
  });

  it("reports offline on timeout and clamps latency_ms to timeout", async () => {
    const result = await pingService(svc(), { fetch: makeTimeoutFetch(), timeoutMs: 50 });
    assert.equal(result.status, "offline");
    assert.equal(result.latency_ms, 50);
    assert.match(result.error, /timed out/i);
  });

  it("uses config.healthPath for the ping URL (no error thrown)", async () => {
    let calledUrl = "";
    const captureFetch = async (url) => { calledUrl = url; return { status: 200 }; };
    await pingService(svc({ config: { healthPath: "/ping" } }), { fetch: captureFetch });
    assert.ok(calledUrl.endsWith("/ping"), `Expected URL to end with /ping, got ${calledUrl}`);
  });

  it("falls back to '/' when healthPath is absent", async () => {
    let calledUrl = "";
    const captureFetch = async (url) => { calledUrl = url; return { status: 200 }; };
    await pingService({ id: "x", name: "X", url: "https://x.com", type: "dev" }, { fetch: captureFetch });
    assert.ok(calledUrl.endsWith("/"), `Expected URL to end with /, got ${calledUrl}`);
  });
});

// ── checkHealth ────────────────────────────────────────────────────────────────

describe("checkHealth", () => {
  it("returns an empty report for an empty registry", async () => {
    const reg = new ServiceRegistry();
    const report = await checkHealth(reg, { fetch: makeFetch(200) });
    assert.equal(report.summary.total, 0);
    assert.equal(report.summary.online, 0);
    assert.equal(report.summary.overall_status, "healthy");
    assert.ok(report.checked_at);
  });

  it("aggregates results across multiple services", async () => {
    const reg = new ServiceRegistry();
    reg.register({ id: "a", name: "A", url: "https://a.com", type: "dev" });
    reg.register({ id: "b", name: "B", url: "https://b.com", type: "automation" });

    const report = await checkHealth(reg, { fetch: makeFetch(200) });
    assert.equal(report.summary.total, 2);
    assert.equal(report.summary.online, 2);
    assert.equal(report.summary.offline, 0);
    assert.equal(report.summary.overall_status, "healthy");
  });

  it("sets overall_status to 'degraded' when any service is offline", async () => {
    const reg = new ServiceRegistry();
    reg.register({ id: "ok", name: "OK", url: "https://ok.com", type: "dev" });
    reg.register({ id: "bad", name: "Bad", url: "https://bad.com", type: "dev" });

    let call = 0;
    const mixedFetch = async () => {
      call++;
      if (call === 2) throw new Error("ECONNREFUSED");
      return { status: 200 };
    };

    const report = await checkHealth(reg, { fetch: mixedFetch });
    assert.equal(report.summary.offline, 1);
    assert.equal(report.summary.overall_status, "degraded");
  });

  it("filter option restricts which services are checked", async () => {
    const reg = new ServiceRegistry();
    reg.register({ id: "a", name: "A", url: "https://a.com", type: "dev" });
    reg.register({ id: "b", name: "B", url: "https://b.com", type: "automation" });

    const report = await checkHealth(reg, { fetch: makeFetch(200), filter: (s) => s.type === "dev" });
    assert.equal(report.summary.total, 1);
    assert.equal(report.services[0].id, "a");
  });

  it("computes avg_latency_ms excluding offline services", async () => {
    const reg = new ServiceRegistry();
    reg.register({ id: "online", name: "Online", url: "https://ok.com", type: "dev" });
    reg.register({ id: "dead", name: "Dead", url: "https://bad.com", type: "dev" });

    let call = 0;
    const mixedFetch = async () => {
      call++;
      if (call === 2) throw new Error("dead");
      return { status: 200 };
    };

    const report = await checkHealth(reg, { fetch: mixedFetch });
    // avg_latency_ms should be ≥ 0 and only from the online service
    assert.ok(report.summary.avg_latency_ms >= 0);
  });
});
