-- Phase TT-5C — Referee V5 outbox consumer inbox (Staging only)
-- Production impact: NONE

-- ═══════════════════════════════════════════════════════════════════
-- 1. Processed-event inbox (exactly-once delivery)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.team_tournament_referee_event_inbox (
  id uuid primary key default gen_random_uuid(),
  outbox_event_id uuid not null unique references public.match_integration_outbox(id) on delete cascade,
  event_type text not null,
  tenant_id text not null,
  tournament_id text not null,
  matchup_id uuid references public.team_tournament_matchups(id) on delete set null,
  sub_match_id uuid references public.team_tournament_sub_matches(id) on delete set null,
  external_sub_match_id text not null,
  referee_match_id text not null,
  result_revision_id uuid references public.match_result_revisions(id) on delete set null,
  result_version integer not null default 0,
  payload_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  source text not null default 'referee_v5',
  correlation_id text,
  status text not null default 'processed'
    check (status in ('processed', 'failed', 'skipped', 'payload_mismatch')),
  error_code text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_tt5c_referee_inbox_tournament
  on public.team_tournament_referee_event_inbox (tenant_id, tournament_id, external_sub_match_id);

alter table public.team_tournament_referee_event_inbox enable row level security;

drop policy if exists tt5c_referee_inbox_manage on public.team_tournament_referee_event_inbox;
create policy tt5c_referee_inbox_manage on public.team_tournament_referee_event_inbox
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      tenant_id = (select venue_id from public.profiles where id = auth.uid())
      and public.team_tournament_can_manage()
    )
  );

revoke all on public.team_tournament_referee_event_inbox from anon;
grant select on public.team_tournament_referee_event_inbox to authenticated;
grant all on public.team_tournament_referee_event_inbox to service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Payload hash helper
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_referee_event_payload_hash(
  p_payload jsonb
)
returns text
language sql
immutable
set search_path = public
as $$
  select md5(coalesce(p_payload::text, '{}'));
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Normalize V5 outbox event types → TT contract labels
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_referee_normalize_event_type(
  p_event_type text,
  p_revision_status text default null
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(p_revision_status, '') in ('cancelled', 'void') then 'REFEREE_MATCH_REOPENED'
    when coalesce(p_event_type, '') = 'STANDINGS_RECALC_REQUESTED'
      and coalesce(p_revision_status, '') in ('overridden', 'OVERRIDDEN') then 'REFEREE_RESULT_REVISED'
    when coalesce(p_event_type, '') = 'STANDINGS_RECALC_REQUESTED' then 'REFEREE_MATCH_FINALIZED'
    else coalesce(p_event_type, 'UNKNOWN')
  end;
$$;

-- Supported consumer triggers (V5 emits STANDINGS_RECALC_REQUESTED on finalize)
create or replace function public.team_tournament_referee_outbox_is_consumable(
  p_event_type text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_event_type, '') in ('STANDINGS_RECALC_REQUESTED');
$$;
