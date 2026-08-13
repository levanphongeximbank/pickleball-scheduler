-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-production-referee-foundation-01
-- LOCAL / Owner GO only. Do NOT apply on Staging/Production without Owner GO.
-- Additive. No business DML. No permission catalog DML. No Staging row copy.
-- STAGING_ROWS_COPIED=0. EXISTING_TOURNAMENT_BACKFILL_REQUIRED=NO.
--
-- FOUNDATION_OWNS tables + helpers + pre-canonical create/eligibility/shell.
-- FINAL_CONTINUATION_OWNS resolve/guard/ensure/triggers + canonical replacements.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. referee_assignments (V5-A + TT5-D + V5-D1 expires_at, baked)
-- ─────────────────────────────────────────────────────────────────
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
    check (status in ('pending', 'active', 'expired', 'revoked', 'completed')),
  token_hash text,
  token_expires_at timestamptz,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoke_reason text,
  external_matchup_id text,
  external_sub_match_id text,
  matchup_id uuid references public.team_tournament_matchups (id) on delete set null,
  sub_match_id uuid references public.team_tournament_sub_matches (id) on delete set null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referee_assignments_tenant_id_tournament_id_match_id_role_r_key
    unique (tenant_id, tournament_id, match_id, role, referee_user_id),
  constraint referee_assignments_expiry_order_chk
    check (expires_at is null or expires_at > assigned_at),
  constraint referee_assignments_revoked_order_chk
    check (revoked_at is null or revoked_at >= assigned_at)
);

create index if not exists referee_assignments_match_idx
  on public.referee_assignments (tenant_id, tournament_id, match_id)
  where status = 'active';

create index if not exists referee_assignments_referee_idx
  on public.referee_assignments (referee_user_id, status);

create index if not exists referee_assignments_sub_match_idx
  on public.referee_assignments (sub_match_id, status)
  where sub_match_id is not null;

create index if not exists referee_assignments_tenant_user_idx
  on public.referee_assignments (tenant_id, referee_user_id, status);

comment on table public.referee_assignments is
  'Canonical Team Tournament referee assignment. Parent matchup: match_id=external_matchup_id AND sub_match_id IS NULL.';

-- ─────────────────────────────────────────────────────────────────
-- 2. match_live_states (V5-A + V5-D snapshot columns, baked)
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.match_live_states (
  id text primary key,
  tenant_id text not null,
  tournament_id text not null,
  match_id text not null,
  game_number integer not null default 1,
  version integer not null default 0,
  revision integer not null default 0,
  state_payload jsonb,
  state_version integer not null default 0,
  status text not null default 'not_started'
    check (status in (
      'not_started', 'in_progress', 'paused', 'game_break',
      'completed', 'locked', 'disputed', 'cancelled'
    )),
  team_a_id text not null,
  team_b_id text not null,
  team_a_score integer not null default 0,
  team_b_score integer not null default 0,
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
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists match_live_states_tournament_idx
  on public.match_live_states (tenant_id, tournament_id);

comment on table public.match_live_states is
  'Referee V5 materialized snapshot. Rows materialize on future referee/match actions only.';

comment on column public.match_live_states.state_payload is
  'Canonical V5 match state JSON snapshot; server-only writes via SECURITY DEFINER RPCs.';

-- ─────────────────────────────────────────────────────────────────
-- 3. team_sub_match_referee_links (TT5-B bridge)
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.team_sub_match_referee_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  team_tournament_id uuid not null references public.team_tournaments(id) on delete cascade,
  matchup_id uuid not null references public.team_tournament_matchups(id) on delete cascade,
  external_matchup_id text not null,
  sub_match_id uuid not null references public.team_tournament_sub_matches(id) on delete cascade,
  external_sub_match_id text not null,
  referee_match_id text not null,
  referee_assignment_id uuid references public.referee_assignments(id) on delete set null,
  status text not null default 'provisioned'
    check (status in (
      'pending', 'provisioned', 'assigned', 'active',
      'finalized', 'sync_error', 'revoked', 'reprovision_required'
    )),
  provision_version integer not null default 1 check (provision_version >= 1),
  provisioned_at timestamptz,
  linked_at timestamptz,
  locked_at timestamptz,
  last_result_revision_id uuid,
  last_outbox_event_id uuid,
  snapshot jsonb not null default '{}'::jsonb,
  revoke_reason text,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version >= 1),
  unique (sub_match_id),
  unique (referee_match_id),
  unique (tenant_id, external_sub_match_id)
);

create index if not exists idx_tt5b_referee_links_tournament
  on public.team_sub_match_referee_links (tenant_id, tournament_id, status);

create index if not exists idx_tt5b_referee_links_matchup
  on public.team_sub_match_referee_links (matchup_id, status);

comment on table public.team_sub_match_referee_links is
  'Bridge: team sub-match external_sub_match_id ↔ Referee V5 match_id. Empty until future provision.';

-- ─────────────────────────────────────────────────────────────────
-- 4. RLS enable + force
-- ─────────────────────────────────────────────────────────────────
alter table public.referee_assignments enable row level security;
alter table public.referee_assignments force row level security;
alter table public.match_live_states enable row level security;
alter table public.match_live_states force row level security;
alter table public.team_sub_match_referee_links enable row level security;
alter table public.team_sub_match_referee_links force row level security;

-- ─────────────────────────────────────────────────────────────────
-- 5. Helpers (internal; not anonymous; not PUBLIC execute)
-- ─────────────────────────────────────────────────────────────────
create or replace function public.referee_v5_assignment_effective_status(
  p_status text,
  p_expires_at timestamptz,
  p_revoked_at timestamptz
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_revoked_at is not null or lower(coalesce(p_status, '')) = 'revoked' then 'revoked'
    when lower(coalesce(p_status, '')) = 'completed' then 'completed'
    when lower(coalesce(p_status, '')) = 'expired' then 'expired'
    when lower(coalesce(p_status, '')) = 'pending' then 'pending'
    when p_expires_at is not null and p_expires_at <= now() then 'expired'
    when lower(coalesce(p_status, '')) = 'active' then 'active'
    else coalesce(lower(p_status), 'pending')
  end;
$$;

create or replace function public.referee_v5_match_state_id(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text
) returns text
language sql
immutable
set search_path = public
as $$
  select p_tenant_id || '::' || p_tournament_id || '::' || p_match_id;
$$;

create or replace function public.referee_v5_current_user_has_assignment(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_roles text[] default array['REFEREE', 'SCOREKEEPER']
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.referee_assignments ra
    where ra.tenant_id = p_tenant_id
      and ra.tournament_id = p_tournament_id
      and ra.match_id = p_match_id
      and ra.referee_user_id = auth.uid()
      and ra.role = any (p_roles)
      and public.referee_v5_assignment_effective_status(ra.status, ra.expires_at, ra.revoked_at)
        in ('pending', 'active')
  );
$$;

create or replace function public.team_tournament_sub_match_is_dreambreaker(
  p_sub_match public.team_tournament_sub_matches,
  p_matchup public.team_tournament_matchups
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_discipline record;
begin
  if exists (
    select 1 from public.team_tournament_dreambreaker_states d
    where d.matchup_id = p_matchup.id
      and coalesce(d.sub_match_external_id, '') = p_sub_match.external_sub_match_id
  ) then
    return true;
  end if;

  select * into v_discipline
  from public.team_tournament_disciplines d
  where d.team_tournament_id = p_matchup.team_tournament_id
    and d.external_discipline_id = p_sub_match.discipline_external_id;

  if v_discipline.id is not null then
    if lower(coalesce(v_discipline.name, '')) like '%dreambreaker%'
      or lower(coalesce(v_discipline.external_discipline_id, '')) like '%dreambreaker%' then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public.team_tournament_build_v5_state_shell(
  p_match_id text,
  p_team_a_id text,
  p_team_b_id text,
  p_players_a text[],
  p_players_b text[],
  p_match_type text,
  p_scoring_format jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_points int := coalesce((p_scoring_format->>'pointsToWin')::int, 11);
  v_win_by int := coalesce((p_scoring_format->>'winBy')::int, 2);
  v_format text := coalesce(nullif(p_scoring_format->>'scoringFormat', ''), 'side_out');
  v_players_a jsonb := '[]'::jsonb;
  v_players_b jsonb := '[]'::jsonb;
  v_first_server text;
  v_sides text[] := array['RIGHT_SERVICE_COURT', 'LEFT_SERVICE_COURT'];
  i int;
begin
  if p_match_type = 'singles' then
    v_players_a := jsonb_build_array(jsonb_build_object(
      'playerId', coalesce(p_players_a[1], 'A1'),
      'logicalServiceSide', 'RIGHT_SERVICE_COURT'
    ));
    v_players_b := jsonb_build_array(jsonb_build_object(
      'playerId', coalesce(p_players_b[1], 'B1'),
      'logicalServiceSide', 'LEFT_SERVICE_COURT'
    ));
    v_first_server := coalesce(p_players_a[1], 'A1');
  else
    for i in 1..2 loop
      v_players_a := v_players_a || jsonb_build_array(jsonb_build_object(
        'playerId', coalesce(p_players_a[i], 'A' || i::text),
        'logicalServiceSide', v_sides[((i - 1) % 2) + 1]
      ));
      v_players_b := v_players_b || jsonb_build_array(jsonb_build_object(
        'playerId', coalesce(p_players_b[i], 'B' || i::text),
        'logicalServiceSide', v_sides[(i % 2) + 1]
      ));
    end loop;
    v_first_server := coalesce(p_players_a[1], 'A1');
  end if;

  return jsonb_build_object(
    'matchId', p_match_id,
    'matchType', p_match_type,
    'status', 'not_started',
    'version', 0,
    'teams', jsonb_build_object(
      'teamA', jsonb_build_object(
        'teamId', p_team_a_id,
        'courtEnd', 'NEAR_END',
        'score', 0,
        'players', v_players_a
      ),
      'teamB', jsonb_build_object(
        'teamId', p_team_b_id,
        'courtEnd', 'FAR_END',
        'score', 0,
        'players', v_players_b
      )
    ),
    'servingTeamId', p_team_a_id,
    'servingPlayerId', v_first_server,
    'serverNumber', case when p_match_type = 'singles' then null else 1 end,
    'scoringFormat', v_format,
    'pointsToWin', v_points,
    'winBy', v_win_by,
    'maximumScore', null,
    'bestOf', 1
  );
end;
$$;

-- Pre-canonical eligibility (child-only assignment match + dreambreaker_out_of_scope).
-- Final continuation replaces this body with parent inheritance.
create or replace function public.team_tournament_provision_eligibility(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups,
  p_sub_match public.team_tournament_sub_matches,
  p_referee_assignment_id uuid default null
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_lineup_a public.team_tournament_lineups;
  v_lineup_b public.team_tournament_lineups;
  v_assignment public.referee_assignments;
  v_existing public.team_sub_match_referee_links;
  v_discipline record;
  v_match_type text;
begin
  if p_sub_match.id is null then
    return jsonb_build_object('eligible', false, 'blockCode', 'NOT_FOUND');
  end if;

  if public.team_tournament_sub_match_is_dreambreaker(p_sub_match, p_matchup) then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'dreambreaker_out_of_scope',
      'blockMessage', 'DreamBreaker nằm ngoài phạm vi TT-5 Referee V5.'
    );
  end if;

  if p_sub_match.status in ('completed', 'forfeit') or p_sub_match.result_confirmed_at is not null then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'sub_match_finalized',
      'blockMessage', 'Trận con đã kết thúc.'
    );
  end if;

  if p_matchup.status not in ('published', 'in_progress') then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'matchup_not_published',
      'blockMessage', 'Matchup chưa công bố.'
    );
  end if;

  if coalesce(p_matchup.requires_republish, false) then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'requires_republish',
      'blockMessage', 'Lineup đã override — cần công bố lại trước khi provision.'
    );
  end if;

  select * into v_lineup_a
  from public.team_tournament_lineups
  where matchup_id = p_matchup.id and team_external_id = p_matchup.team_a_id;

  select * into v_lineup_b
  from public.team_tournament_lineups
  where matchup_id = p_matchup.id and team_external_id = p_matchup.team_b_id;

  if v_lineup_a.id is null or v_lineup_b.id is null
     or v_lineup_a.status <> 'published' or v_lineup_b.status <> 'published' then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'lineup_not_published',
      'blockMessage', 'Cả hai lineup phải published.'
    );
  end if;

  select * into v_existing
  from public.team_sub_match_referee_links l
  where l.sub_match_id = p_sub_match.id and l.status <> 'revoked';

  if v_existing.id is not null then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'bridge_already_exists',
      'blockMessage', 'Sub-match đã có liên kết Referee V5.',
      'linkId', v_existing.id,
      'status', v_existing.status
    );
  end if;

  if p_referee_assignment_id is null then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'assignment_required',
      'blockMessage', 'Cần referee assignment trước khi provision.'
    );
  end if;

  select * into v_assignment
  from public.referee_assignments a
  where a.id = p_referee_assignment_id;

  if v_assignment.id is null then
    return jsonb_build_object('eligible', false, 'blockCode', 'assignment_not_found');
  end if;

  if v_assignment.tenant_id <> p_header.tenant_id
     or v_assignment.tournament_id <> p_header.tournament_id
     or v_assignment.match_id <> p_sub_match.external_sub_match_id then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'assignment_scope_mismatch',
      'blockMessage', 'Assignment không khớp tenant/tournament/sub-match.'
    );
  end if;

  if public.referee_v5_assignment_effective_status(
       v_assignment.status, v_assignment.expires_at, v_assignment.revoked_at
     ) not in ('pending', 'active') then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'assignment_not_active',
      'blockMessage', 'Assignment không active.'
    );
  end if;

  select * into v_discipline
  from public.team_tournament_disciplines d
  where d.team_tournament_id = p_header.id
    and d.external_discipline_id = p_sub_match.discipline_external_id;

  v_match_type := case
    when coalesce(v_discipline.category_type, 'doubles') = 'singles' then 'singles'
    else 'doubles'
  end;

  return jsonb_build_object(
    'eligible', true,
    'blockCode', null,
    'matchType', v_match_type,
    'lineupAVersion', v_lineup_a.version,
    'lineupBVersion', v_lineup_b.version,
    'matchupVersion', p_matchup.version,
    'subMatchVersion', p_sub_match.version
  );
end;
$$;

-- Pre-canonical create: child sub-match only. Parent-scope assignment is owned by the final continuation.
create or replace function public.team_tournament_create_referee_assignment(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_referee_user_id uuid,
  p_expires_at timestamptz default null,
  p_activate boolean default true,
  p_idempotency_key text default null,
  p_reason text default 'tt5d_assign'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_sub_match public.team_tournament_sub_matches;
  v_profile public.profiles;
  v_existing public.referee_assignments;
  v_row public.referee_assignments;
  v_status text;
  v_cmd json;
  v_effective text;
  v_result jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED', 'error', 'Phiên đăng nhập hết hạn — đăng nhập lại.');
  end if;
  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Không đủ quyền thực hiện thao tác này.');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy giải hoặc tài nguyên liên quan.');
  end if;
  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'CROSS_TENANT_DENIED', 'error', 'Từ chối truy cập ngoài tenant.');
  end;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'create_referee_assignment', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id,
      'subMatchId', p_sub_match_id,
      'refereeUserId', p_referee_user_id,
      'expiresAt', p_expires_at,
      'reason', p_reason
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id;
  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy trận đấu.');
  end if;
  if nullif(btrim(coalesce(v_matchup.team_a_id, '')), '') is null
     or nullif(btrim(coalesce(v_matchup.team_b_id, '')), '') is null then
    return json_build_object(
      'ok', false,
      'code', 'MATCHUP_TEAMS_UNRESOLVED',
      'error', 'Trận chưa đủ hai đội (placeholder knockout). Không gán trọng tài.'
    );
  end if;

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id
    and sm.external_sub_match_id = p_sub_match_id;
  if v_sub_match.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy trận con.');
  end if;

  select * into v_profile from public.profiles where id = p_referee_user_id;
  if v_profile.id is null then
    return json_build_object('ok', false, 'code', 'REFEREE_NOT_FOUND', 'error', 'Không tìm thấy hồ sơ trọng tài (profiles id).');
  end if;

  v_status := case when coalesce(p_activate, true) then 'active' else 'pending' end;

  update public.referee_assignments
     set status = 'revoked',
         revoked_at = now(),
         revoked_by = auth.uid(),
         revoke_reason = coalesce(nullif(btrim(p_reason), ''), 'tt5d_supersede'),
         version = version + 1,
         updated_at = now()
   where tenant_id = v_header.tenant_id
     and tournament_id = v_header.tournament_id
     and match_id = v_sub_match.external_sub_match_id
     and role = 'REFEREE'
     and referee_user_id is distinct from p_referee_user_id
     and public.referee_v5_assignment_effective_status(status, expires_at, revoked_at)
       in ('pending', 'active');

  select * into v_existing
  from public.referee_assignments ra
  where ra.tenant_id = v_header.tenant_id
    and ra.tournament_id = v_header.tournament_id
    and ra.match_id = v_sub_match.external_sub_match_id
    and ra.referee_user_id = p_referee_user_id
    and ra.role = 'REFEREE'
  for update;

  if v_existing.id is not null then
    v_effective := public.referee_v5_assignment_effective_status(
      v_existing.status, v_existing.expires_at, v_existing.revoked_at
    );
    if v_effective in ('pending', 'active') then
      v_result := jsonb_build_object(
        'ok', true,
        'replayed', true,
        'assignmentId', v_existing.id,
        'status', v_effective,
        'version', v_existing.version
      );
      perform public.team_tournament_finish_command(
        v_header.tenant_id, p_tournament_id, 'create_referee_assignment',
        p_idempotency_key, v_cmd->>'payload_hash', v_result
      );
      return v_result;
    end if;

    update public.referee_assignments set
      status = v_status,
      revoked_at = null,
      revoked_by = null,
      revoke_reason = null,
      assigned_by = auth.uid(),
      assigned_at = now(),
      expires_at = p_expires_at,
      external_matchup_id = v_matchup.external_matchup_id,
      external_sub_match_id = v_sub_match.external_sub_match_id,
      matchup_id = v_matchup.id,
      sub_match_id = v_sub_match.id,
      referee_display_name = coalesce(v_profile.display_name, v_profile.email, 'Referee'),
      version = version + 1,
      updated_at = now()
    where id = v_existing.id
    returning * into v_row;
  else
    begin
      insert into public.referee_assignments (
        tenant_id, tournament_id, match_id,
        external_matchup_id, external_sub_match_id,
        matchup_id, sub_match_id,
        referee_user_id, referee_display_name,
        role, status, assigned_by, assigned_at, expires_at, version
      ) values (
        v_header.tenant_id, v_header.tournament_id, v_sub_match.external_sub_match_id,
        v_matchup.external_matchup_id, v_sub_match.external_sub_match_id,
        v_matchup.id, v_sub_match.id,
        p_referee_user_id, coalesce(v_profile.display_name, v_profile.email, 'Referee'),
        'REFEREE', v_status, auth.uid(), now(), p_expires_at, 1
      )
      returning * into v_row;
    exception when unique_violation then
      select * into v_existing
      from public.referee_assignments ra
      where ra.tenant_id = v_header.tenant_id
        and ra.tournament_id = v_header.tournament_id
        and ra.match_id = v_sub_match.external_sub_match_id
        and ra.referee_user_id = p_referee_user_id
        and ra.role = 'REFEREE';
      if v_existing.id is not null then
        return json_build_object(
          'ok', true,
          'replayed', true,
          'assignmentId', v_existing.id,
          'status', public.referee_v5_assignment_effective_status(
            v_existing.status, v_existing.expires_at, v_existing.revoked_at
          ),
          'version', v_existing.version
        );
      end if;
      return json_build_object(
        'ok', false,
        'code', 'REFEREE_ASSIGNMENT_CONFLICT',
        'error', 'Trọng tài này đã được gán cho trận. Tải lại danh sách — không tạo assignment trùng.'
      );
    end;
  end if;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.referee_v5.assignment_upserted', v_sub_match.external_sub_match_id,
    jsonb_build_object(
      'assignmentId', v_row.id,
      'refereeUserId', p_referee_user_id,
      'status', v_status,
      'matchupId', p_matchup_id,
      'subMatchId', p_sub_match_id,
      'version', v_row.version
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'assignmentId', v_row.id,
    'refereeMatchId', v_row.match_id,
    'status', v_status,
    'version', v_row.version,
    'expiresAt', v_row.expires_at
  );
  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'create_referee_assignment',
    p_idempotency_key, v_cmd->>'payload_hash', v_result
  );
  return v_result;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 6. RLS policies (tenant via user_venue_id(); referee via assignment)
--    Client table writes denied. Writes go through SECURITY DEFINER RPCs.
-- ─────────────────────────────────────────────────────────────────
drop policy if exists referee_assignments_select on public.referee_assignments;
create policy referee_assignments_select on public.referee_assignments
  for select
  to authenticated
  using (
    public.is_super_admin()
    or (
      tenant_id = public.user_venue_id()
      and public.team_tournament_can_manage()
    )
    or referee_user_id = auth.uid()
  );

drop policy if exists referee_assignments_no_client_insert on public.referee_assignments;
create policy referee_assignments_no_client_insert on public.referee_assignments
  for insert to authenticated with check (false);
drop policy if exists referee_assignments_no_client_update on public.referee_assignments;
create policy referee_assignments_no_client_update on public.referee_assignments
  for update to authenticated using (false);
drop policy if exists referee_assignments_no_client_delete on public.referee_assignments;
create policy referee_assignments_no_client_delete on public.referee_assignments
  for delete to authenticated using (false);

drop policy if exists match_live_states_select on public.match_live_states;
create policy match_live_states_select on public.match_live_states
  for select
  to authenticated
  using (
    public.is_super_admin()
    or (
      tenant_id = public.user_venue_id()
      and public.team_tournament_can_manage()
    )
    or public.referee_v5_current_user_has_assignment(tenant_id, tournament_id, match_id)
  );

drop policy if exists match_live_states_no_client_insert on public.match_live_states;
create policy match_live_states_no_client_insert on public.match_live_states
  for insert to authenticated with check (false);
drop policy if exists match_live_states_no_client_update on public.match_live_states;
create policy match_live_states_no_client_update on public.match_live_states
  for update to authenticated using (false);
drop policy if exists match_live_states_no_client_delete on public.match_live_states;
create policy match_live_states_no_client_delete on public.match_live_states
  for delete to authenticated using (false);

drop policy if exists team_sub_match_referee_links_select on public.team_sub_match_referee_links;
create policy team_sub_match_referee_links_select on public.team_sub_match_referee_links
  for select
  to authenticated
  using (
    public.is_super_admin()
    or (
      tenant_id = public.user_venue_id()
      and public.team_tournament_can_manage()
    )
    or public.referee_v5_current_user_has_assignment(tenant_id, tournament_id, referee_match_id)
  );

drop policy if exists team_sub_match_referee_links_no_client_insert on public.team_sub_match_referee_links;
create policy team_sub_match_referee_links_no_client_insert on public.team_sub_match_referee_links
  for insert to authenticated with check (false);
drop policy if exists team_sub_match_referee_links_no_client_update on public.team_sub_match_referee_links;
create policy team_sub_match_referee_links_no_client_update on public.team_sub_match_referee_links
  for update to authenticated using (false);
drop policy if exists team_sub_match_referee_links_no_client_delete on public.team_sub_match_referee_links;
create policy team_sub_match_referee_links_no_client_delete on public.team_sub_match_referee_links
  for delete to authenticated using (false);

-- ─────────────────────────────────────────────────────────────────
-- 7. Least-privilege grants
-- ─────────────────────────────────────────────────────────────────
revoke all on table public.referee_assignments from public, anon;
revoke all on table public.match_live_states from public, anon;
revoke all on table public.team_sub_match_referee_links from public, anon;

grant select on table public.referee_assignments to authenticated;
grant select on table public.match_live_states to authenticated;
grant select on table public.team_sub_match_referee_links to authenticated;

grant all on table public.referee_assignments to service_role;
grant all on table public.match_live_states to service_role;
grant all on table public.team_sub_match_referee_links to service_role;

revoke all on function public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)
  to authenticated, service_role;

revoke all on function public.referee_v5_match_state_id(text, text, text)
  from public, anon, authenticated;
grant execute on function public.referee_v5_match_state_id(text, text, text)
  to service_role;

revoke all on function public.referee_v5_current_user_has_assignment(text, text, text, text[])
  from public, anon;
grant execute on function public.referee_v5_current_user_has_assignment(text, text, text, text[])
  to authenticated, service_role;

revoke all on function public.team_tournament_sub_match_is_dreambreaker(team_tournament_sub_matches, team_tournament_matchups)
  from public, anon, authenticated;
grant execute on function public.team_tournament_sub_match_is_dreambreaker(team_tournament_sub_matches, team_tournament_matchups)
  to service_role;

revoke all on function public.team_tournament_build_v5_state_shell(text, text, text, text[], text[], text, jsonb)
  from public, anon, authenticated;
grant execute on function public.team_tournament_build_v5_state_shell(text, text, text, text[], text[], text, jsonb)
  to service_role;

revoke all on function public.team_tournament_provision_eligibility(team_tournaments, team_tournament_matchups, team_tournament_sub_matches, uuid)
  from public, anon, authenticated;
grant execute on function public.team_tournament_provision_eligibility(team_tournaments, team_tournament_matchups, team_tournament_sub_matches, uuid)
  to service_role;

revoke all on function public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)
  from public, anon;
grant execute on function public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)
  to authenticated, service_role;
