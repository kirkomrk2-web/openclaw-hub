-- Migration: 20260310_activity_events.sql
-- Creates the activity_events table used by the activity-feed Edge Function.
-- Stores real-time system events visible in the OpenClaw Hub dashboard.

-- ────────────────────────────────────────────────
-- 1. activity_events table
-- ────────────────────────────────────────────────
create table if not exists public.activity_events (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('success', 'info', 'warning', 'error')),
  message     text not null,
  source      text not null default 'unknown',
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- Index for dashboard queries: newest first, filter by type / source
create index if not exists idx_activity_events_created_at
  on public.activity_events (created_at desc);

create index if not exists idx_activity_events_type
  on public.activity_events (type);

create index if not exists idx_activity_events_source
  on public.activity_events (source);

-- ────────────────────────────────────────────────
-- 2. Row-Level Security
-- ────────────────────────────────────────────────
alter table public.activity_events enable row level security;

-- Service role (Edge Functions) can do anything
create policy "service_role_all"
  on public.activity_events
  as permissive
  for all
  to service_role
  using (true)
  with check (true);

-- Authenticated users can read events
create policy "authenticated_read"
  on public.activity_events
  as permissive
  for select
  to authenticated
  using (true);

-- Authenticated users can insert their own events
create policy "authenticated_insert"
  on public.activity_events
  as permissive
  for insert
  to authenticated
  with check (true);

-- ────────────────────────────────────────────────
-- 3. Retention: auto-delete events older than 30 days
--    (requires pg_cron extension, skip if not available)
-- ────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    perform cron.schedule(
      'cleanup-activity-events',
      '0 3 * * *',
      $$
        delete from public.activity_events
        where created_at < now() - interval '30 days';
      $$
    );
  end if;
end;
$$;

-- ────────────────────────────────────────────────
-- 4. Seed: initial placeholder events (mirrors dashboard mock data)
-- ────────────────────────────────────────────────
insert into public.activity_events (type, message, source, created_at)
values
  ('success', 'Молти health check OK',                   'molti-agent',   now() - interval '30 minutes'),
  ('info',    'n8n Wallester workflow triggered',          'n8n',           now() - interval '34 minutes'),
  ('warning', 'KeePassXC credential accessed',            'keepassxc',     now() - interval '47 minutes'),
  ('info',    'Airtop session terminated gracefully',      'airtop',        now() - interval '60 minutes'),
  ('error',   'VPS High CPU Alert: 87%',                  'vps-monitor',   now() - interval '75 minutes'),
  ('success', 'Supabase sync completed',                  'supabase',      now() - interval '90 minutes'),
  ('info',    'GitHub push detected: main branch',         'github',        now() - interval '108 minutes'),
  ('success', 'Memory maintenance completed',              'molti-agent',   now() - interval '122 minutes')
on conflict do nothing;
