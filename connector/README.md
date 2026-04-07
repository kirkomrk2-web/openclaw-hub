# OpenClaw Hub — Connector Framework

A **hub-and-spoke plugin system** for connecting every repo in the kirkomrk2-web organisation
(`openclaw-platform`, `wallestars-ssot`, `bg-business-platform`, `RhythmClaw`, …) to shared
infrastructure services through a uniform interface.

---

## Architecture

```
openclaw-hub (this repo)
│
├── connector/
│   ├── registry.js          ← Service Registry  (catalogue of all services)
│   ├── health.js            ← Health Check Aggregator
│   │
│   ├── connectors/
│   │   ├── base.js          ← Abstract Connector Interface
│   │   ├── supabase.js      ← Supabase (database)
│   │   ├── n8n.js           ← n8n (automation)
│   │   ├── github.js        ← GitHub (dev)
│   │   ├── telegram.js      ← Telegram Bot (messaging)
│   │   └── index.js         ← re-exports
│   │
│   ├── api/
│   │   └── status.js        ← Dashboard Status API
│   │
│   └── tests/               ← Node built-in test runner suite
```

---

## Concepts

### Service Registry (`registry.js`)

Central catalogue for platform services. Any code can register a service entry and other
parts of the system (health checks, dashboard) discover it dynamically.

```js
import { registry } from './registry.js';

// Register
registry.register({
  id: 'supabase',
  name: 'Supabase',
  url: 'https://xyzxyz.supabase.co',
  type: 'database',          // 'database' | 'automation' | 'dev' | 'messaging' | 'ai' | 'hosting'
  config: { healthPath: '/rest/v1/', anonKey: process.env.SUPABASE_ANON_KEY },
});

// Discover
const dbs = registry.list({ type: 'database' });
const found = registry.discover(s => s.name.startsWith('Git'));

// Update / remove
registry.update('supabase', { name: 'Supabase v2' });
registry.deregister('supabase');
```

### Health Check Aggregator (`health.js`)

Pings every registered service in parallel and returns a unified health report.

```js
import { checkHealth } from './health.js';
import { registry }    from './registry.js';

const report = await checkHealth(registry, { timeoutMs: 5000 });
// {
//   services: [ { id, name, url, type, status, latency_ms, status_code, checked_at } ],
//   summary:  { total, online, degraded, offline, avg_latency_ms, overall_status },
//   checked_at: '...'
// }
```

### Connector Plugin Interface (`connectors/base.js`)

All connectors extend `BaseConnector` and implement three methods:

| Method | Description |
|---|---|
| `connect()` | Establish / verify the connection |
| `disconnect()` | Tear down the connection |
| `ping()` | Lightweight reachability probe |

Built-in connectors:

| Connector | id | type |
|---|---|---|
| `SupabaseConnector` | `supabase` | `database` |
| `N8nConnector` | `n8n` | `automation` |
| `GitHubConnector` | `github` | `dev` |
| `TelegramConnector` | `telegram` | `messaging` |

```js
import { SupabaseConnector, GitHubConnector } from './connectors/index.js';

const supa = new SupabaseConnector({
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
});
await supa.connect();       // state → 'connected'
const health = await supa.ping();   // { status, latency_ms, status_code }
supa.registerWith(registry);        // auto-upserts into the registry
```

### Dashboard Status API (`api/status.js`)

Returns a unified JSON snapshot — works as an Express route, a Supabase Edge Function handler,
or a plain async function.

```js
import { createStatusHandler } from './api/status.js';
import { registry }            from './registry.js';

// Express
const handler = createStatusHandler(registry, { timeoutMs: 6000 });
app.get('/api/status', handler);

// Raw call (scripts / Edge Functions)
const report = await handler();
```

`quickStatus()` is a one-liner that pre-populates the registry from env vars:

```js
import { quickStatus } from './api/status.js';

const report = await quickStatus({
  supabaseUrl:      process.env.SUPABASE_URL,
  supabaseAnonKey:  process.env.SUPABASE_ANON_KEY,
  n8nUrl:           process.env.N8N_URL,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
});
console.log(report.summary.overall_status); // 'healthy' | 'warning' | 'degraded'
```

---

## Writing a Custom Connector

```js
// connectors/my-platform.js
import { BaseConnector } from './base.js';

export class MyPlatformConnector extends BaseConnector {
  constructor(config) {
    super('my-platform', 'My Platform', 'hosting', config);
    this._fetch = config._fetch ?? fetch;
  }

  async connect() {
    const result = await this.ping();
    this._setState(result.status === 'offline' ? 'error' : 'connected', result.error);
  }

  async ping() {
    const start = Date.now();
    try {
      const res = await this._fetch(`${this.config.url}/health`);
      return { status: res.ok ? 'online' : 'degraded', latency_ms: Date.now() - start, status_code: res.status };
    } catch (err) {
      return { status: 'offline', latency_ms: Date.now() - start, status_code: null, error: err.message };
    }
  }
}
```

---

## Running Tests

Requires **Node.js ≥ 20** (uses the built-in `node:test` runner — no extra dependencies).

```bash
cd connector
npm test
```

---

## Connected Repositories

| Repo | Service id | Type |
|---|---|---|
| openclaw-platform | `supabase` | database |
| wallestars-ssot | `n8n` | automation |
| bg-business-platform | `github` | dev |
| RhythmClaw | `telegram` | messaging |

Any repository can add its own connector by extending `BaseConnector` and registering with the shared `registry`.
