// supabase/functions/n8n-workflows/index.ts
// PhantomChat Backend — n8n Workflows Proxy Edge Function
//
// Acts as an authenticated proxy between the frontend and n8n REST API.
// Keeps the n8n API key server-side; the browser never sees it.
//
// Supported routes (appended after /n8n-workflows):
//   GET  /                        → list workflows (with pagination)
//   GET  /:id                     → get single workflow
//   GET  /:id/activate            → activate workflow
//   GET  /:id/deactivate          → deactivate workflow
//   GET  /executions              → list recent executions
//   GET  /executions/:id          → get single execution
//   POST /executions/:id/retry    → retry a failed execution
//   GET  /health                  → proxy health check (no n8n call)
//
// Query params forwarded to n8n as-is (limit, cursor, active, workflowId, etc.)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const N8N_BASE = "https://n8n.srv1201204.hstgr.cloud/api/v1";

function n8nHeaders(): HeadersInit {
  const key = Deno.env.get("N8N_API_KEY");
  if (!key) throw new Error("N8N_API_KEY env var is not set");
  return {
    "X-N8N-API-KEY": key,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

async function proxyRequest(
  n8nPath: string,
  method: string,
  body?: unknown
): Promise<Response> {
  const upstream = await fetch(`${N8N_BASE}${n8nPath}`, {
    method,
    headers: n8nHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const data = await upstream.text();

  return new Response(data, {
    status: upstream.status,
    headers: { ...corsHeaders, "Content-Type": contentType },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Strip the function prefix — everything after /n8n-workflows
    // In Supabase Edge Functions, pathname starts with /n8n-workflows
    const pathParts = url.pathname.split("/n8n-workflows");
    const subPath = pathParts[pathParts.length - 1] || "/";

    // Forward original query string to n8n
    const queryString = url.search;

    // ── Health check (no upstream call)
    if (subPath === "/health" || subPath === "/health/") {
      return new Response(
        JSON.stringify({ status: "ok", proxy: "n8n-workflows", timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── GET / → list workflows
    if (subPath === "/" || subPath === "") {
      return proxyRequest(`/workflows${queryString}`, "GET");
    }

    // ── GET /executions → list executions
    if (subPath === "/executions" || subPath.startsWith("/executions?")) {
      return proxyRequest(`/executions${queryString}`, "GET");
    }

    // ── POST /executions/:id/retry
    const retryMatch = subPath.match(/^\/executions\/([^/]+)\/retry\/?$/);
    if (retryMatch && req.method === "POST") {
      return proxyRequest(`/executions/${retryMatch[1]}/retry`, "POST");
    }

    // ── GET /executions/:id
    const execMatch = subPath.match(/^\/executions\/([^/]+)\/?$/);
    if (execMatch) {
      return proxyRequest(`/executions/${execMatch[1]}${queryString}`, "GET");
    }

    // ── GET /:id/activate
    const activateMatch = subPath.match(/^\/([^/]+)\/activate\/?$/);
    if (activateMatch) {
      return proxyRequest(`/workflows/${activateMatch[1]}/activate`, "POST");
    }

    // ── GET /:id/deactivate
    const deactivateMatch = subPath.match(/^\/([^/]+)\/deactivate\/?$/);
    if (deactivateMatch) {
      return proxyRequest(`/workflows/${deactivateMatch[1]}/deactivate`, "POST");
    }

    // ── GET /:id → single workflow
    const workflowMatch = subPath.match(/^\/([^/]+)\/?$/);
    if (workflowMatch) {
      return proxyRequest(`/workflows/${workflowMatch[1]}${queryString}`, "GET");
    }

    return new Response(
      JSON.stringify({ error: "Not found", path: subPath }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[n8n-workflows]", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
