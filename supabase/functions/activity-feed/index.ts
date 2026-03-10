// supabase/functions/activity-feed/index.ts
// PhantomChat Backend — Activity Feed Edge Function
// Returns recent activity events from the activity_events table.
// Supports: GET (list), POST (create event)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface ActivityEvent {
  id?: string;
  type: "success" | "info" | "warning" | "error";
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "50");
    const type = url.searchParams.get("type"); // filter by type
    const source = url.searchParams.get("source"); // filter by source

    // POST — create a new activity event
    if (req.method === "POST") {
      const body: ActivityEvent = await req.json();

      if (!body.type || !body.message) {
        return new Response(
          JSON.stringify({ error: "type and message are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("activity_events")
        .insert({
          type: body.type,
          message: body.message,
          source: body.source ?? "unknown",
          metadata: body.metadata ?? {},
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, event: data }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET — fetch recent activity events
    let query = supabase
      .from("activity_events")
      .select("id, type, message, source, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 200));

    if (type) query = query.eq("type", type);
    if (source) query = query.eq("source", source);

    const { data, error } = await query;
    if (error) throw error;

    // Format for frontend: add time field (HH:MM)
    const events = (data ?? []).map((row) => ({
      ...row,
      time: new Date(row.created_at).toLocaleTimeString("bg-BG", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Sofia",
      }),
    }));

    return new Response(
      JSON.stringify({
        events,
        count: events.length,
        fetched_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[activity-feed]", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
