-- Phase V5-A — Referee V5 Foundation (DRAFT — NOT APPLIED)
-- system_version: referee-v5
-- Status: DRAFT — NOT APPLIED
-- KHÔNG apply Production | KHÔNG apply Staging | KHÔNG migrate tournament_match_live
-- Chạy SAU owner GO và sau supabase-rbac.sql

-- ─── Permissions (draft) ─────────────────────────────────────────
insert into public.permissions (id, module, action, description)
values
  ('referee_v5.view_assigned', 'referee_v5', 'view', 'Xem trận được phân công V5'),
  ('referee_v5.apply_event', 'referee_v5', 'apply_event', 'Gửi match event (intent only)'),
  ('referee_v5.finalize', 'referee_v5', 'finalize', 'Chốt kết quả trận V5'),
  ('referee_v5.override', 'referee_v5', 'override', 'Override kết quả có lý do'),
  ('referee_v5.resolve_dispute', 'referee_v5', 'resolve_dispute', 'Xử lý tranh chấp'),
  ('referee_v5.assign', 'referee_v5', 'assign', 'Phân công trọng tài V5')
on conflict (id) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

-- ─── referee_assignments ───────────────────────────────────────────
create table if not exists public.referee_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  match_id text not null,
  referee_user_id uuid references public.profiles (id) on delete set null,
  referee_display_name text not null default '',
  role text not null default 'REFEREE'
    check (role in ('REFEREE', 'SCOREKEEPER', 'HEAD_REFEREE')),
  status text not null default 'active'
    check (status in ('active', 'revoked', 'completed')),
  token_hash text,  -- optional session token hash, NOT plain text
  token_expires_at timestamptz,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, tournament_id, match_id, role, referee_user_id)
);

create index if not exists referee_assignments_match_idx
  on public.referee_assignments (tenant_id, tournament_id, match_id)
  where status = 'active';

create index if not exists referee_assignments_referee_idx
  on public.referee_assignments (referee_user_id, status);

-- ─── match_live_states (materialized snapshot) ───────────────────
create table if not exists public.match_live_states (
  id text primary key,  -- {tenant_id}::{tournament_id}::{match_id}
  tenant_id text not null,
  tournament_id text not null,
  match_id text not null,
  game_number integer not null default 1,
  version integer not null default 0,
  revision integer not null default 0,
  status text not null default 'not_started'
    check (status in (
      'not_started', 'in_progress', 'paused', 'game_break',
      'completed', 'locked', 'disputed', 'cancelled'
    )),
  team_a_id text not null,
  team_b_id text not null,
  team_a_score integer not null default 0,
  team_b_score integer not null default 0,
  -- Side-out display (optional; null for rally-only)
  team_a_side_out_score integer,
  team_b_side_out_score integer,
  server_number smallint check (server_number in (1, 2)),
  serving_team_id text,
  serving_player_id text,
  receiving_team_id text,
  receiving_player_id text,
  serving_court_side text
    check (serving_court_side in ('LEFT_SERVICE_COURT', 'RIGHT_SERVICE_COURT')),
  receiving_court_side text
    check (receiving_court_side in ('LEFT_SERVICE_COURT', 'RIGHT_SERVICE_COURT')),
  serving_court_end text
    check (serving_court_end in ('NEAR_END', 'FAR_END')),
  receiving_court_end text
    check (receiving_court_end in ('NEAR_END', 'FAR_END')),
  -- Derived from ends+sides; optional cache — prefer compute in engine
  serve_direction text,
  court_orientation text not null default 'REFEREE_PHYSICAL_VIEW'
    check (court_orientation in ('REFEREE_PHYSICAL_VIEW', 'TEAM_FIXED_VIEW')),
  team_a_end text check (team_a_end in ('NEAR_END', 'FAR_END')),
  team_b_end text check (team_b_end in ('NEAR_END', 'FAR_END')),
  participants jsonb not null default '[]'::jsonb,
  scoring_format jsonb not null default '{}'::jsonb,
  points_to_win integer,
  win_by integer,
  maximum_score integer,
  best_of smallint not null default 1,
  scoring_system text not null default 'side_out'
    check (scoring_system in ('side_out', 'rally')),
  last_event_sequence bigint not null default 0,
  locked_at timestamptz,
  locked_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists match_live_states_tournament_idx
  on public.match_live_states (tenant_id, tournament_id);

-- ─── match_participant_positions (optional normalized; snapshot also in JSON) ─
create table if not exists public.match_participant_positions (
  id uuid primary key default gen_random_uuid(),
  match_state_id text not null references public.match_live_states (id) on delete cascade,
  tenant_id text not null,
  player_id text not null,
  team_id text not null,
  court_end text not null check (court_end in ('NEAR_END', 'FAR_END')),
  court_side text not null check (court_side in ('LEFT_SERVICE_COURT', 'RIGHT_SERVICE_COURT')),
  is_server boolean not null default false,
  is_receiver boolean not null default false,
  snapshot_version integer not null,
  updated_at timestamptz not null default now(),
  unique (match_state_id, player_id, snapshot_version)
);

-- ─── match_events (append-only) ──────────────────────────────────
create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  match_id text not null,
  match_state_id text not null references public.match_live_states (id) on delete restrict,
  game_number integer not null default 1,
  event_sequence bigint not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  state_version_before integer not null,
  state_version_after integer not null,
  reverted_event_id uuid references public.match_events (id) on delete restrict,
  client_mutation_id text,
  idempotency_key text,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (match_state_id, event_sequence),
  unique (match_state_id, idempotency_key)
);

create index if not exists match_events_match_idx
  on public.match_events (tenant_id, tournament_id, match_id, event_sequence);

-- ─── match_game_states ───────────────────────────────────────────
create table if not exists public.match_game_states (
  id uuid primary key default gen_random_uuid(),
  match_state_id text not null references public.match_live_states (id) on delete cascade,
  tenant_id text not null,
  game_number integer not null,
  team_a_score integer not null default 0,
  team_b_score integer not null default 0,
  winner_team_id text,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'forfeit')),
  started_at timestamptz,
  completed_at timestamptz,
  unique (match_state_id, game_number)
);

-- ─── match_result_revisions (official locked outcomes) ───────────
create table if not exists public.match_result_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  match_id text not null,
  revision integer not null default 1,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'disputed', 'overridden', 'void')),
  team_a_id text not null,
  team_b_id text not null,
  winner_team_id text,
  final_score jsonb not null default '{}'::jsonb,
  games jsonb not null default '[]'::jsonb,
  completion_reason text,
  finalized_by uuid references public.profiles (id) on delete set null,
  finalized_at timestamptz not null default now(),
  override_reason text,
  overridden_by uuid references public.profiles (id) on delete set null,
  idempotency_key text not null,
  rating_evidence_id uuid,  -- FK to rating_v5 evidence when integrated
  rating_applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, tournament_id, match_id, revision),
  unique (tenant_id, tournament_id, match_id, idempotency_key)
);

-- ─── match_incidents ─────────────────────────────────────────────
create table if not exists public.match_incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  match_id text not null,
  incident_type text not null,
  description text not null default '',
  reported_by uuid references public.profiles (id) on delete set null,
  reported_at timestamptz not null default now(),
  related_event_id uuid references public.match_events (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

-- ─── match_disputes ────────────────────────────────────────────────
create table if not exists public.match_disputes (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  match_id text not null,
  result_revision_id uuid references public.match_result_revisions (id) on delete restrict,
  status text not null default 'open'
    check (status in ('open', 'under_review', 'resolved', 'rejected')),
  filed_by uuid references public.profiles (id) on delete set null,
  filed_at timestamptz not null default now(),
  deadline_at timestamptz,
  resolution text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  evidence_files jsonb not null default '[]'::jsonb
);

-- ─── referee_device_sessions ─────────────────────────────────────
create table if not exists public.referee_device_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  assignment_id uuid references public.referee_assignments (id) on delete cascade,
  device_label text,
  is_primary boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ─── match_sync_mutations (idempotency ledger) ─────────────────────
create table if not exists public.match_sync_mutations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  match_state_id text not null references public.match_live_states (id) on delete cascade,
  client_mutation_id text not null,
  idempotency_key text not null,
  mutation_type text not null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb,
  status text not null default 'applied'
    check (status in ('applied', 'rejected', 'conflict')),
  created_at timestamptz not null default now(),
  unique (match_state_id, idempotency_key),
  unique (match_state_id, client_mutation_id)
);

-- ─── RLS enable (policies in PHASE V5E — NOT APPLIED) ────────────
alter table public.referee_assignments enable row level security;
alter table public.match_live_states enable row level security;
alter table public.match_events enable row level security;
alter table public.match_result_revisions enable row level security;
alter table public.match_disputes enable row level security;
alter table public.match_sync_mutations enable row level security;

-- ─── RPC stubs (implement in PHASE V5E — NOT APPLIED) ────────────
-- referee_v5_apply_match_event(p_match_state_id, p_event_type, p_payload, p_expected_version, p_idempotency_key)
-- referee_v5_get_match_state(p_match_state_id)
-- referee_v5_finalize_match_result(p_match_state_id, p_idempotency_key, p_expected_version)
-- referee_v5_rebuild_state(p_match_state_id)

-- DRAFT — NOT APPLIED
