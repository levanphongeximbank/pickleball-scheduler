-- CC-02 — Competition Core Rating Model V2 (Supabase)
-- Phase: CC-02 | NOT FOR PRODUCTION APPLY without owner GO
-- Depends on: pick_vn_player_ratings (PHASE_30), profiles
-- Idempotent: safe to re-run CREATE IF NOT EXISTS sections

-- ─── player_ratings (canonical competition + public skill SSOT per tenant) ───
create table if not exists public.player_ratings (
  id text primary key,
  player_id text not null,
  tenant_id text,
  auth_user_id uuid references public.profiles (id) on delete set null,
  public_skill_level numeric(3, 1),
  competition_elo numeric(8, 2) not null default 1500,
  daily_play_rating numeric(8, 2),
  provisional_skill_level numeric(3, 1),
  rating_confidence numeric(5, 2) not null default 0 check (rating_confidence >= 0 and rating_confidence <= 100),
  rating_status text not null default 'provisional'
    check (rating_status in ('provisional', 'verified', 'locked', 'suspended')),
  competition_match_count integer not null default 0,
  daily_match_count integer not null default 0,
  verified_at timestamptz,
  locked_at timestamptz,
  backfill_source text,
  backfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, tenant_id)
);

create index if not exists player_ratings_player_tenant_idx
  on public.player_ratings (player_id, tenant_id);

create index if not exists player_ratings_auth_user_idx
  on public.player_ratings (auth_user_id);

-- ─── rating_history (audit trail) ───
create table if not exists public.rating_history (
  id text primary key,
  player_rating_id text not null references public.player_ratings (id) on delete cascade,
  field_name text not null,
  previous_value numeric,
  next_value numeric,
  delta numeric,
  source text not null default 'system',
  match_id text,
  tournament_id text,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists rating_history_player_rating_idx
  on public.rating_history (player_rating_id, created_at desc);

-- ─── rating_proposals (monthly review V2 — no auto public update) ───
create table if not exists public.rating_proposals (
  id text primary key,
  player_rating_id text not null references public.player_ratings (id) on delete cascade,
  review_month text not null,
  current_level numeric(3, 1) not null,
  proposed_level numeric(3, 1) not null,
  competition_elo numeric(8, 2),
  estimated_skill_level numeric(3, 1),
  mapping_version text not null default 'v1',
  confidence numeric(5, 2) not null default 0,
  direction text not null default 'none'
    check (direction in ('up', 'down', 'none')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired')),
  source text not null default 'monthly_review',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  expires_at timestamptz,
  unique (player_rating_id, review_month, status)
);

create index if not exists rating_proposals_status_idx
  on public.rating_proposals (status, review_month);

-- ─── rating_confidence_events ───
create table if not exists public.rating_confidence_events (
  id text primary key,
  player_rating_id text not null references public.player_ratings (id) on delete cascade,
  previous_confidence numeric(5, 2) not null default 0,
  next_confidence numeric(5, 2) not null default 0,
  event_type text not null,
  match_id text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists rating_confidence_events_player_idx
  on public.rating_confidence_events (player_rating_id, created_at desc);

-- ─── Verification queries (run after staging apply) ───
-- select count(*) from public.player_ratings;
-- select rating_status, count(*) from public.player_ratings group by 1;
-- select status, count(*) from public.rating_proposals group by 1;
-- select count(*) from public.rating_history where source = 'migration';

-- ─── Rollback (manual, phase CC-02 only — do not drop pick_vn_player_ratings) ───
-- drop table if exists public.rating_confidence_events;
-- drop table if exists public.rating_proposals;
-- drop table if exists public.rating_history;
-- drop table if exists public.player_ratings;
