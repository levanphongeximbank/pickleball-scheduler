-- Disposable local PostgreSQL bootstrap: Production-like Team Tournament
-- prestate WITHOUT referee foundation objects.
-- Never point this at Staging (qyewbxjsiiyufanzcjcq) or Production (expuvcohlcjzvrrauvud).

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text default '',
  role text not null default 'PLAYER',
  venue_id text,
  club_id text,
  player_id text,
  phone text default '',
  status text not null default 'active'
);

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'SUPER_ADMIN'
      and p.status = 'active'
  );
$$;

create or replace function public.user_venue_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.venue_id from public.profiles p
  where p.id = auth.uid() and p.status = 'active'
  limit 1;
$$;

create or replace function public.user_has_permission(p_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin();
$$;

create table if not exists public.team_tournaments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  club_id text not null default 'club',
  tournament_id text not null,
  name text not null default 'tt',
  status text not null default 'draft',
  settings jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, tournament_id)
);

create table if not exists public.team_tournament_matchups (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  team_tournament_id uuid not null references public.team_tournaments(id) on delete cascade,
  external_matchup_id text not null,
  team_a_id text not null default '',
  team_b_id text not null default '',
  status text not null default 'lineup_open',
  result jsonb,
  version integer not null default 1,
  requires_republish boolean not null default false,
  schedule_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_tournament_id, external_matchup_id)
);

create table if not exists public.team_tournament_sub_matches (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null default '',
  matchup_id uuid not null references public.team_tournament_matchups(id) on delete cascade,
  external_sub_match_id text not null,
  discipline_external_id text not null default 'mlp-wd',
  sort_order int not null default 1,
  status text not null default 'waiting',
  score jsonb not null default '{"teamA":0,"teamB":0,"games":[]}'::jsonb,
  winner_team_id text,
  result_confirmed_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (matchup_id, external_sub_match_id)
);

create table if not exists public.team_tournament_lineups (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default '',
  matchup_id uuid not null references public.team_tournament_matchups(id) on delete cascade,
  team_external_id text not null,
  status text not null default 'not_submitted',
  version integer not null default 1,
  unique (matchup_id, team_external_id)
);

create table if not exists public.team_tournament_lineup_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default '',
  tournament_id text not null default '',
  lineup_id uuid not null references public.team_tournament_lineups(id) on delete cascade,
  discipline_external_id text not null,
  player_id text not null,
  sort_order int not null default 1
);

create table if not exists public.team_tournament_disciplines (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default '',
  team_tournament_id uuid not null references public.team_tournaments(id) on delete cascade,
  external_discipline_id text not null,
  name text not null default '',
  category_type text not null default 'doubles',
  scoring_format jsonb not null default '{}'::jsonb,
  sort_order int not null default 1,
  discipline_kind text,
  activation_rule text,
  unique (team_tournament_id, external_discipline_id)
);

create table if not exists public.team_tournament_dreambreaker_states (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  matchup_id uuid not null unique references public.team_tournament_matchups(id) on delete cascade,
  status text not null default 'pending',
  team_a_order jsonb not null default '[]'::jsonb,
  team_b_order jsonb not null default '[]'::jsonb,
  team_a_score integer not null default 0,
  team_b_score integer not null default 0,
  winner_team_id text,
  rotation jsonb not null default '{}'::jsonb,
  sub_match_external_id text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.team_tournament_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or public.user_has_permission('team.manage');
$$;

create or replace function public.team_tournament_can_manage_results()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or public.user_has_permission('team.match.result.manage');
$$;

create or replace function public.team_tournament_assert_tenant(p_tenant_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if public.is_super_admin() then
    return;
  end if;
  if public.user_venue_id() is null or public.user_venue_id() <> p_tenant_id then
    raise exception 'access_denied: cross-tenant';
  end if;
end;
$$;

create or replace function public.team_tournament_resolve_header(p_tournament_id text)
returns public.team_tournaments
language sql
stable
security definer
set search_path = public
as $$
  select tt.*
  from public.team_tournaments tt
  where tt.tournament_id = p_tournament_id
  limit 1;
$$;

create or replace function public.team_tournament_begin_command(
  p_tenant_id text,
  p_tournament_id text,
  p_command_name text,
  p_idempotency_key text,
  p_payload jsonb
)
returns json
language sql
stable
as $$
  select json_build_object('ok', true, 'replay', false, 'payload_hash', 'bootstrap');
$$;

create or replace function public.team_tournament_finish_command(
  p_tenant_id text,
  p_tournament_id text,
  p_command_name text,
  p_idempotency_key text,
  p_payload_hash text,
  p_result jsonb
)
returns void
language plpgsql
as $$
begin
  null;
end;
$$;

create or replace function public.team_tournament_write_audit(
  p_tenant_id text,
  p_tournament_id text,
  p_action text,
  p_resource_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
as $$
begin
  null;
end;
$$;

create or replace function public.team_tournament_start_dreambreaker(
  p_tournament_id text,
  p_matchup_id text,
  p_expected_version integer default null,
  p_idempotency_key text default null
)
returns json
language sql
stable
as $$
  select json_build_object('ok', false, 'code', 'BOOTSTRAP_STUB');
$$;

create or replace function public.team_tournament_confirm_sub_match(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_score jsonb,
  p_winner_team_id text default null,
  p_expected_version integer default null,
  p_idempotency_key text default null
)
returns json
language sql
stable
as $$
  select json_build_object('ok', false, 'code', 'BOOTSTRAP_STUB');
$$;
