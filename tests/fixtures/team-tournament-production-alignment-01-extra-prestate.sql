-- Extra Production-like prestate for alignment local Postgres.
-- Applied AFTER foundation bootstrap and BEFORE foundation APPLY + alignment PRECHECK.
-- Never point at Staging or Production.

alter table public.team_tournaments
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

alter table public.team_tournament_disciplines
  add column if not exists tournament_id text not null default '',
  add column if not exists gender_requirement text not null default 'any',
  add column if not exists player_count integer not null default 2,
  add column if not exists counts_toward_result boolean not null default true,
  add column if not exists enabled boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.team_tournament_lineups
  add column if not exists tournament_id text not null default '',
  add column if not exists selections jsonb not null default '{}'::jsonb,
  add column if not exists source text,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists submitted_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists overridden_at timestamptz,
  add column if not exists overridden_by uuid,
  add column if not exists override_reason text,
  add column if not exists previous_lineup_version integer,
  add column if not exists audit_note text;

alter table public.team_tournament_matchups
  add column if not exists tournament_id text not null default '',
  add column if not exists scheduled_at timestamptz,
  add column if not exists lineup_lock_at timestamptz,
  add column if not exists court_label text,
  add column if not exists updated_by uuid;

alter table public.team_tournament_sub_matches
  add column if not exists updated_by uuid;

alter table public.profiles
  add column if not exists gender text,
  add column if not exists display_name text;

create table if not exists public.canonical_tournaments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  club_id text not null,
  external_key text,
  name text not null,
  mode text not null,
  status text not null default 'draft',
  season_id text,
  league_id text,
  payload jsonb not null default '{}'::jsonb,
  engine_v4 jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  display_name text not null default '',
  user_id uuid,
  status text not null default 'active',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  team_tournament_id uuid not null references public.team_tournaments(id) on delete cascade,
  external_team_id text not null,
  name text not null,
  color text,
  logo_url text,
  captain_player_id text,
  deputy_player_ids text[] not null default '{}',
  absent_player_ids text[] not null default '{}',
  locked_player_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  withdrawn boolean not null default false,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  unique (team_tournament_id, external_team_id)
);

create table if not exists public.team_tournament_team_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  team_id uuid not null references public.team_tournament_teams(id) on delete cascade,
  player_id text not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (team_id, player_id)
);

create table if not exists public.team_tournament_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  team_tournament_id uuid not null references public.team_tournaments(id) on delete cascade,
  external_group_id text not null,
  name text not null default '',
  sort_order integer not null default 1,
  team_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_tournament_id, external_group_id)
);

create table if not exists public.team_tournament_command_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  command_name text not null,
  idempotency_key text not null,
  payload_hash text,
  result jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, tournament_id, command_name, idempotency_key)
);

create table if not exists public.team_tournament_standings (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default '',
  team_tournament_id uuid not null references public.team_tournaments(id) on delete cascade,
  team_external_id text not null,
  rank integer,
  played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  sub_match_wins integer not null default 0,
  sub_match_losses integer not null default 0,
  sub_match_diff integer not null default 0,
  points_scored integer not null default 0,
  points_conceded integer not null default 0,
  ranking_points integer not null default 0,
  version integer not null default 1,
  unique (team_tournament_id, team_external_id)
);

create table if not exists public.team_tournament_lineup_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  lineup_id uuid not null references public.team_tournament_lineups(id) on delete cascade,
  revision_no integer not null,
  action_type text not null,
  status_before text,
  status_after text,
  selections_before jsonb,
  selections_after jsonb,
  version_before integer,
  version_after integer,
  reason text,
  request_id text,
  actor_id uuid,
  actor_role text,
  created_at timestamptz not null default now()
);

create or replace function public.team_tournament_version_conflict(
  p_entity text, p_expected integer, p_actual integer
)
returns json
language sql
stable
as $$
  select json_build_object(
    'ok', false, 'code', 'VERSION_CONFLICT',
    'entity', p_entity, 'expected', p_expected, 'actual', p_actual
  );
$$;

create or replace function public.team_tournament_is_captain(
  p_team_tournament_id uuid, p_team_external_id text, p_player_id text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.team_tournament_teams t
    where t.team_tournament_id = p_team_tournament_id
      and t.external_team_id = p_team_external_id
      and (
        t.captain_player_id = p_player_id
        or coalesce(t.deputy_player_ids, '{}'::text[]) @> array[p_player_id]
      )
  );
$$;

create or replace function public.team_tournament_setup_mutation_prepare(
  p_tournament_id text,
  p_envelope jsonb,
  p_expected_command text,
  p_expected_version integer,
  p_idempotency_key text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
begin
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  return json_build_object(
    'ok', true,
    'replay', false,
    'header', to_jsonb(v_header),
    'envelope', coalesce(p_envelope, '{}'::jsonb)
  );
end;
$$;

create or replace function public.team_tournament_get_setup(
  p_tournament_id text,
  p_viewer_team_id text,
  p_schema_version integer,
  p_diagnostic boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);
  return json_build_object(
    'ok', true,
    'schemaVersion', p_schema_version,
    'tournament', json_build_object(
      'id', v_header.tournament_id,
      'name', v_header.name,
      'status', v_header.status,
      'settings', v_header.settings,
      'version', v_header.version
    )
  );
end;
$$;

create or replace function public.team_tournament_get_setup(
  p_tournament_id text,
  p_viewer_team_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.team_tournament_get_setup(p_tournament_id, p_viewer_team_id, 7, false);
end;
$$;

create or replace function public.team_tournament_user_player_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(p.player_id), ''), '')
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.team_tournament_save_lineup_draft(
  p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb
)
returns json language sql stable as $$
  select json_build_object('ok', false, 'code', 'BOOTSTRAP_STUB_4ARG');
$$;

create or replace function public.team_tournament_submit_lineup(
  p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb
)
returns json language sql stable as $$
  select json_build_object('ok', false, 'code', 'BOOTSTRAP_STUB_4ARG');
$$;

create or replace function public.team_tournament_publish_matchup(
  p_tournament_id text, p_matchup_id text
)
returns json language sql stable as $$
  select json_build_object('ok', false, 'code', 'BOOTSTRAP_STUB_2ARG');
$$;

create or replace function public.team_tournament_save_sub_match_draft(
  p_tournament_id text, p_matchup_id text, p_sub_match_id text, p_score jsonb
)
returns json language sql stable as $$
  select json_build_object('ok', false, 'code', 'BOOTSTRAP_STUB_4ARG');
$$;

create or replace function public.team_tournament_lock_matchup(
  p_tournament_id text, p_matchup_id text
)
returns json language sql stable as $$
  select json_build_object('ok', false, 'code', 'BOOTSTRAP_STUB_2ARG');
$$;

create or replace function public.team_tournament_confirm_sub_match(
  p_tournament_id text, p_matchup_id text, p_sub_match_id text, p_score jsonb, p_winner_team_id text
)
returns json language sql stable as $$
  select public.team_tournament_confirm_sub_match(
    p_tournament_id, p_matchup_id, p_sub_match_id, p_score, p_winner_team_id, null, null
  );
$$;

create or replace function public.team_tournament_write_lineup_revision(
  p_tenant_id text, p_tournament_id text, p_lineup_id uuid, p_action_type text,
  p_status_before text, p_status_after text, p_selections_before jsonb, p_selections_after jsonb,
  p_version_before integer, p_version_after integer, p_reason text, p_request_id text
)
returns void language plpgsql as $$ begin null; end; $$;

create or replace function public.team_tournament_upsert_standings(
  p_tournament_id text, p_standings jsonb
)
returns json language sql stable as $$
  select json_build_object('ok', true, 'legacy', true);
$$;

insert into public.team_tournaments (tenant_id, club_id, tournament_id, name, status, settings)
select
  'venue-alignment',
  'club-hist',
  'hist-' || gs::text,
  'Historical ' || gs::text,
  'draft',
  '{}'::jsonb
from generate_series(1, 82) gs
on conflict (tenant_id, tournament_id) do nothing;
