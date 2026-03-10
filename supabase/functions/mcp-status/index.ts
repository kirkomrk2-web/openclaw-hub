// supabase/functions/mcp-status/index.ts
// PhantomChat Backend — MCP Server Status Edge Function
// Pings known MCP servers and returns their status + response latency.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

interface McpServer {
  id: string;
  name: string;
  url: string;
  healthPath: string;
  category: "automation" | "database" | "hosting" | "ai" | "dev";
}

interface McpStatusResult {
  id: string;
  name: string;
  url: string;
  category: string;
  status: "online" | "offline" | "degraded";
  latency_ms: number | null;
  status_code: number | null;
  checked_at: string;
  error?: string;
}

// Known MCP / API endpoints to monitor
const MCP_SERVERS: McpServer[] = [
  {
    id: "n8n",
    name: "n8n Automation",
    url: "https://n8n.srv1201204.hstgr.cloud",
    healthPath: "/healthz",
    category: "automation",
  },
  {
    id: "supabase",
    name: "Supabase API",
    url: `https://${Deno.env.get("SUPABASE_URL")?.replace("https://", "") ?? "ansiaiuaygcfztabtknl.supabase.co"}`,
    healthPath: "/rest/v1/",
    category: "database",
  },
  {
    id: "vps",
    name: "VPS (srv1201204)",
    url: "https://n8n.srv1201204.hstgr.cloud",
    healthPath: "/healthz",
    category: "hosting",
  },
  {
    id: "github",
    name: "GitHub API",
    url: "https://api.github.com",
    healthPath: "/",
    category: "dev",
  },
  {
    id: "gemini",
    name: "Google AI (Gemini)",
    url: "https://generativelanguage.googleapis.com",
    healthPath: "/",
    category: "ai",
  },
];

async function pingServer(server: McpServer): Promise<McpStatusResult> {
  const pingUrl = `${server.url}${server.healthPath}`;
  const start = Date.now();
  const checkedAt = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const res = await fetch(pingUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "OpenClaw-MCP-Monitor/1.0" },
    });
    clearTimeout(timeoutId);

    const latency = Date.now() - start;
    const isOk = res.status < 500;

    return {
      id: server.id,
      name: server.name,
      url: server.url,
      category: server.category,
      status: isOk ? (latency > 3000 ? "degraded" : "online") : "degraded",
      latency_ms: latency,
      status_code: res.status,
      checked_at: checkedAt,
    };
  } catch (err) {
    const latency = Date.now() - start;
    const isTimeout = err instanceof Error && err.name === "AbortError";

    return {
      id: server.id,
      name: server.name,
      url: server.url,
      category: server.category,
      status: "offline",
      latency_ms: isTimeout ? 8000 : latency,
      status_code: null,
      checked_at: checkedAt,
      error: isTimeout ? "Request timed out (8s)" : (err instanceof Error ? err.message : "Unknown error"),
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const serverId = url.searchParams.get("id"); // optionally ping a single server

    const targets = serverId
      ? MCP_SERVERS.filter((s) => s.id === serverId)
      : MCP_SERVERS;

    if (targets.length === 0) {
      return new Response(
        JSON.stringify({ error: `Unknown server id: ${serverId}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ping all servers in parallel
    const results = await Promise.all(targets.map(pingServer));

    const online = results.filter((r) => r.status === "online").length;
    const degraded = results.filter((r) => r.status === "degraded").length;
    const offline = results.filter((r) => r.status === "offline").length;

    const avgLatency =
      results
        .filter((r) => r.latency_ms !== null && r.status !== "offline")
        .reduce((sum, r) => sum + (r.latency_ms ?? 0), 0) /
        Math.max(results.filter((r) => r.status !== "offline").length, 1);

    return new Response(
      JSON.stringify({
        servers: results,
        summary: {
          total: results.length,
          online,
          degraded,
          offline,
          avg_latency_ms: Math.round(avgLatency),
          overall_status: offline > 0 || degraded > 0 ? (offline > 0 ? "degraded" : "warning") : "healthy",
        },
        checked_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[mcp-status]", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
