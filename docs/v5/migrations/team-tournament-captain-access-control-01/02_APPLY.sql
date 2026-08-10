-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-captain-access-control-01
-- Workstream: TEAM-TOURNAMENT-PR412-CAPTAIN-ACCESS-W0-W1-IMPLEMENTATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
--
-- Adds:
--   settings.captainAccessEnabled (JSONB key; no column migration)
--   backfill true where key absent
--   team_tournament_captain_access_enabled
--   team_tournament_assert_captain_portal_access
--   team_tournament_guard_captain_portal_write
--   team_tournament_set_captain_access
--   team_tournament_get_captain_portal
--   captain write gates on lineup draft/submit path + visible lineups + dreambreaker order
-- Does NOT:
--   alter public publication logic
--   alter organizer get_setup contract
--   change RLS
--   mutate match/lineup payload data
-- ═══════════════════════════════════════════════════════════════════

-- A/B. Backfill existing tournaments: true ONLY where key is absent
update public.team_tournaments
set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('captainAccessEnabled', true),
    updated_at = now()
where not (coalesce(settings, '{}'::jsonb) ? 'captainAccessEnabled');

-- C. Helpers
create or replace function public.team_tournament_captain_access_enabled(
  p_settings jsonb
)
returns boolean
language sql
immutable
as $$
  select coalesce((p_settings ->> 'captainAccessEnabled')::boolean, false);
$$;

comment on function public.team_tournament_captain_access_enabled(jsonb) is
  'PR412: explicit true only; missing/null ⇒ false (fail closed after backfill).';

create or replace function public.team_tournament_assert_captain_portal_access(
  p_tournament_id text,
  p_team_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_player_id text;
  v_team_id text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'cross_tenant_denied', 'error', 'Không có quyền tenant.');
  end;

  if not public.team_tournament_captain_access_enabled(v_header.settings) then
    return json_build_object(
      'ok', false,
      'code', 'captain_portal_closed',
      'error', 'Portal đội trưởng chưa được mở.',
      'captainAccessEnabled', false
    );
  end if;

  v_player_id := public.team_tournament_user_player_id();
  if v_player_id is null or btrim(v_player_id) = '' then
    return json_build_object('ok', false, 'code', 'IDENTITY_UNPROVEN', 'error', 'Không xác định được danh tính vận động viên.');
  end if;

  v_team_id := nullif(trim(coalesce(p_team_id, '')), '');
  if v_team_id is null then
    select t.external_team_id
    into v_team_id
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and (
        t.captain_player_id = v_player_id
        or v_player_id = any(coalesce(t.deputy_player_ids, '{}'::text[]))
      )
    order by t.created_at
    limit 1;
  end if;

  if v_team_id is null then
    return json_build_object('ok', false, 'code', 'captain_scope_denied', 'error', 'Chỉ đội trưởng hoặc đội phó mới truy cập được.');
  end if;

  if not public.team_tournament_is_captain(v_header.id, v_team_id, v_player_id) then
    return json_build_object('ok', false, 'code', 'captain_scope_denied', 'error', 'Không có quyền đội này.');
  end if;

  return json_build_object(
    'ok', true,
    'captainAccessEnabled', true,
    'viewerTeamId', v_team_id,
    'viewerPlayerId', v_player_id,
    'tournamentId', v_header.tournament_id,
    'version', v_header.version
  );
end;
$$;

create or replace function public.team_tournament_guard_captain_portal_write(
  p_header public.team_tournaments,
  p_team_id text
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_player_id text;
begin
  -- Organizer/manage bypass (does not grant captain role; keeps BTC tools working).
  if public.team_tournament_can_manage() then
    return json_build_object('ok', true, 'bypass', 'manage');
  end if;

  if not public.team_tournament_captain_access_enabled(p_header.settings) then
    return json_build_object(
      'ok', false,
      'code', 'captain_portal_closed',
      'error', 'Portal đội trưởng chưa được mở.'
    );
  end if;

  v_player_id := public.team_tournament_user_player_id();
  if v_player_id is null or btrim(coalesce(p_team_id, '')) = '' then
    return json_build_object('ok', false, 'code', 'captain_scope_denied', 'error', 'Không có quyền sửa đội hình đội này.');
  end if;

  if not (
    public.user_has_permission('team.lineup.submit')
    and public.team_tournament_is_captain(p_header.id, p_team_id, v_player_id)
  ) then
    return json_build_object('ok', false, 'code', 'captain_scope_denied', 'error', 'Không có quyền sửa đội hình đội này.');
  end if;

  return json_build_object('ok', true, 'bypass', 'captain');
end;
$$;

-- D. Manage-only writer
create or replace function public.team_tournament_set_captain_access(
  p_tournament_id text,
  p_enabled boolean,
  p_expected_version integer default null,
  p_idempotency_key text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_new_version integer;
  v_enabled boolean := coalesce(p_enabled, false);
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'cross_tenant_denied', 'error', 'Không có quyền tenant.');
  end;

  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Chỉ BTC được mở/đóng Portal đội trưởng.');
  end if;

  if p_expected_version is not null and v_header.version is distinct from p_expected_version then
    return json_build_object(
      'ok', false,
      'code', 'VERSION_CONFLICT',
      'expectedVersion', p_expected_version,
      'actualVersion', v_header.version
    );
  end if;

  update public.team_tournaments
  set
    settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
      'captainAccessEnabled', v_enabled,
      'captainAccess', jsonb_strip_nulls(jsonb_build_object(
        'enabled', v_enabled,
        'updatedAt', now(),
        'updatedBy', auth.uid()::text
      ))
    ),
    version = version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_header.id
  returning version into v_new_version;

  perform public.team_tournament_write_audit(
    v_header.tenant_id,
    v_header.tournament_id,
    'team.captain_access.set',
    v_header.tournament_id,
    jsonb_build_object(
      'captainAccessEnabled', v_enabled,
      'expectedVersion', p_expected_version,
      'idempotencyKey', p_idempotency_key,
      'version', v_new_version
    )
  );

  return json_build_object(
    'ok', true,
    'captainAccessEnabled', v_enabled,
    'version', v_new_version,
    'tournamentId', v_header.tournament_id
  );
end;
$$;

-- E. Scoped captain portal reader (does not replace get_setup)
create or replace function public.team_tournament_get_captain_portal(
  p_tournament_id text,
  p_schema_version integer default 7
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assert json;
  v_header public.team_tournaments;
  v_viewer_team_id text;
  v_player_id text;
  v_teams json;
  v_my_team json;
  v_opponent_teams json;
  v_matchups json;
  v_lineups json;
  v_disciplines json;
  v_is_captain boolean := false;
  v_is_deputy boolean := false;
begin
  if p_schema_version is distinct from null and p_schema_version is distinct from 7 then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'schemaVersion phải là 7.');
  end if;

  v_assert := public.team_tournament_assert_captain_portal_access(p_tournament_id, null);
  if not coalesce((v_assert->>'ok')::boolean, false) then
    return v_assert;
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  v_viewer_team_id := v_assert->>'viewerTeamId';
  v_player_id := v_assert->>'viewerPlayerId';

  select exists (
    select 1 from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and t.external_team_id = v_viewer_team_id
      and t.captain_player_id = v_player_id
  ) into v_is_captain;

  select exists (
    select 1 from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and t.external_team_id = v_viewer_team_id
      and v_player_id = any(coalesce(t.deputy_player_ids, '{}'::text[]))
  ) into v_is_deputy;

  select coalesce(json_agg(json_build_object(
    'id', d.external_discipline_id,
    'name', d.name,
    'playerCount', d.player_count,
    'sortOrder', d.sort_order
  ) order by d.sort_order, d.created_at), '[]'::json)
  into v_disciplines
  from public.team_tournament_disciplines d
  where d.team_tournament_id = v_header.id;

  select row_to_json(x)
  into v_my_team
  from (
    select
      t.external_team_id as id,
      t.name,
      t.captain_player_id as "captainPlayerId",
      coalesce(t.deputy_player_ids, '{}'::text[]) as "deputyPlayerIds",
      coalesce((
        select json_agg(m.player_id order by m.created_at)
        from public.team_tournament_team_members m
        where m.team_id = t.id
      ), '[]'::json) as "playerIds"
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and t.external_team_id = v_viewer_team_id
  ) x;

  select coalesce(json_agg(json_build_object(
    'id', m.external_matchup_id,
    'teamAId', m.team_a_id,
    'teamBId', m.team_b_id,
    'status', m.status,
    'scheduledAt', m.scheduled_at,
    'courtLabel', m.court_label,
    'lineupLockAt', m.lineup_lock_at,
    'roundNumber', m.schedule_meta->>'roundNumber',
    'stage', m.schedule_meta->>'stage',
    'groupId', m.schedule_meta->>'groupId'
  ) order by m.scheduled_at nulls last, m.created_at), '[]'::json)
  into v_matchups
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and (m.team_a_id = v_viewer_team_id or m.team_b_id = v_viewer_team_id);

  select coalesce(json_agg(json_build_object(
    'id', t.external_team_id,
    'name', t.name
  ) order by t.name), '[]'::json)
  into v_opponent_teams
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id
    and t.external_team_id <> v_viewer_team_id
    and exists (
      select 1
      from public.team_tournament_matchups m
      where m.team_tournament_id = v_header.id
        and (m.team_a_id = v_viewer_team_id or m.team_b_id = v_viewer_team_id)
        and (m.team_a_id = t.external_team_id or m.team_b_id = t.external_team_id)
    );

  select coalesce(json_object_agg(
    l.team_external_id || '::' || mu.external_matchup_id,
    json_build_object(
      'matchupId', mu.external_matchup_id,
      'teamId', l.team_external_id,
      'status', l.status,
      'selections', case
        when l.team_external_id = v_viewer_team_id then l.selections
        when mu.status in ('published', 'in_progress', 'completed') then l.selections
        when l.published_at is not null then l.selections
        else null
      end,
      'submittedAt', l.submitted_at,
      'lockedAt', l.locked_at,
      'publishedAt', l.published_at,
      'version', l.version
    )
  ), '{}'::json)
  into v_lineups
  from public.team_tournament_lineups l
  join public.team_tournament_matchups mu on mu.id = l.matchup_id
  where mu.team_tournament_id = v_header.id
    and (mu.team_a_id = v_viewer_team_id or mu.team_b_id = v_viewer_team_id)
    and (
      l.team_external_id = v_viewer_team_id
      or mu.status in ('published', 'in_progress', 'completed')
      or l.published_at is not null
    );

  v_teams := json_build_array(v_my_team);

  return json_build_object(
    'ok', true,
    'schemaVersion', 7,
    'serverTime', now(),
    'viewerTeamId', v_viewer_team_id,
    'captainAccessEnabled', true,
    'viewer', json_build_object(
      'userId', auth.uid(),
      'viewerTeamId', v_viewer_team_id,
      'captain', v_is_captain,
      'deputy', v_is_deputy
    ),
    'permissions', json_build_object(
      'canViewTeams', true,
      'canViewSchedule', true,
      'canSubmitLineup', true,
      'canManageTournament', false
    ),
    'tournament', json_build_object(
      'id', v_header.tournament_id,
      'clubId', v_header.club_id,
      'tenantId', v_header.tenant_id,
      'name', v_header.name,
      'status', v_header.status,
      'version', v_header.version,
      'settings', jsonb_build_object(
        'captainAccessEnabled', true,
        'lineupLockLeadMinutes', v_header.settings->'lineupLockLeadMinutes',
        'rosterRules', v_header.settings->'rosterRules',
        'schedulePublish', v_header.settings->'schedulePublish'
      ),
      'disciplines', v_disciplines,
      'myTeam', v_my_team,
      'opponentTeams', v_opponent_teams,
      'teams', v_teams,
      'matchups', v_matchups,
      'lineups', v_lineups
    )
  );
end;
$$;

-- F. Captain write gate — save_lineup_draft_legacy (shared by draft + submit paths)
create or replace function public.team_tournament_save_lineup_draft_legacy(
  p_tournament_id text,
  p_matchup_id text,
  p_team_id text,
  p_selections jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_lineup_id uuid;
  v_gate json;
  v_validation jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'cross_tenant_denied', 'error', 'Không có quyền tenant.');
  end;

  v_gate := public.team_tournament_guard_captain_portal_write(v_header, p_team_id);
  if not coalesce((v_gate->>'ok')::boolean, false) then
    return v_gate;
  end if;

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy matchup.');
  end if;

  if v_matchup.lineup_lock_at is not null and now() >= v_matchup.lineup_lock_at then
    return json_build_object('ok', false, 'code', 'deadline_passed', 'error', 'Đã quá giờ khóa đội hình.');
  end if;

  if to_regprocedure('public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)') is not null then
    v_validation := public.team_tournament_validate_lineup_selections(
      v_header, p_team_id, p_matchup_id, coalesce(p_selections, '{}'::jsonb), false
    );
    if not (v_validation->>'ok')::boolean then
      return v_validation;
    end if;
  end if;

  select l.id into v_lineup_id
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = p_team_id;

  if v_lineup_id is null then
    insert into public.team_tournament_lineups (
      tenant_id, tournament_id, matchup_id, team_external_id,
      status, selections, source, created_by, updated_by
    ) values (
      v_header.tenant_id, v_header.tournament_id, v_matchup.id, p_team_id,
      'draft', coalesce(p_selections, '{}'::jsonb), 'captain', auth.uid(), auth.uid()
    ) returning id into v_lineup_id;
  else
    if exists (
      select 1 from public.team_tournament_lineups
      where id = v_lineup_id and locked_at is not null
    ) then
      return json_build_object('ok', false, 'code', 'lineup_locked', 'error', 'Đội hình đã khóa.');
    end if;

    update public.team_tournament_lineups set
      status = 'draft',
      selections = coalesce(p_selections, '{}'::jsonb),
      updated_at = now(),
      updated_by = auth.uid()
    where id = v_lineup_id;
  end if;

  if to_regprocedure('public.team_tournament_sync_lineup_entries(uuid,text,text,jsonb)') is not null then
    perform public.team_tournament_sync_lineup_entries(
      v_lineup_id, v_header.tenant_id, v_header.tournament_id, p_selections
    );
  end if;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id, 'team.lineup.draft', p_matchup_id,
    jsonb_build_object('teamId', p_team_id, 'selections', p_selections)
  );

  return json_build_object('ok', true, 'lineupId', v_lineup_id);
end;
$$;

-- F. get_visible_lineups — deny captain path when portal closed
create or replace function public.team_tournament_get_visible_lineups(
  p_tournament_id text,
  p_matchup_id text,
  p_viewer_team_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_is_manage boolean;
  v_can_results boolean;
  v_lineups json;
  v_player_id text;
  v_viewer text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy matchup.');
  end if;

  v_is_manage := public.team_tournament_can_manage();
  v_can_results := public.team_tournament_can_manage_results();
  v_player_id := public.team_tournament_user_player_id();
  v_viewer := nullif(trim(coalesce(p_viewer_team_id, '')), '');

  if not v_is_manage and not v_can_results then
    if not public.team_tournament_captain_access_enabled(v_header.settings) then
      return json_build_object(
        'ok', false,
        'code', 'captain_portal_closed',
        'error', 'Portal đội trưởng chưa được mở.'
      );
    end if;
    if v_viewer is not null
       and v_player_id is not null
       and not public.team_tournament_is_captain(v_header.id, v_viewer, v_player_id) then
      return json_build_object('ok', false, 'code', 'captain_scope_denied', 'error', 'Không có quyền xem đội hình đội này.');
    end if;
  end if;

  select coalesce(json_object_agg(
    l.team_external_id,
    json_build_object(
      'matchupId', p_matchup_id,
      'teamId', l.team_external_id,
      'status', l.status,
      'selections', case
        when v_is_manage then l.selections
        when l.team_external_id = coalesce(v_viewer, '') then l.selections
        when v_can_results and v_matchup.status in ('published','in_progress','completed') then l.selections
        when v_matchup.status in ('published','in_progress','completed') then l.selections
        when l.published_at is not null then l.selections
        else null
      end,
      'submittedAt', l.submitted_at,
      'lockedAt', l.locked_at,
      'publishedAt', l.published_at,
      'source', l.source,
      'version', l.version
    )
  ), '{}'::json)
  into v_lineups
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id
    and (
      v_is_manage
      or l.team_external_id = coalesce(v_viewer, '')
      or (
        v_can_results
        and v_matchup.status in ('published','in_progress','completed')
      )
      or v_matchup.status in ('published','in_progress','completed')
      or l.published_at is not null
    );

  return json_build_object(
    'ok', true,
    'matchupId', p_matchup_id,
    'matchupStatus', v_matchup.status,
    'serverTime', now(),
    'lineups', v_lineups
  );
end;
$$;

-- F. Dreambreaker captain submit gate
create or replace function public.team_tournament_submit_dreambreaker_order(
  p_tournament_id text,
  p_matchup_id text,
  p_team_id text,
  p_order jsonb,
  p_expected_version integer default null,
  p_idempotency_key text default null
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_team public.team_tournament_teams;
  v_db public.team_tournament_dreambreaker_states;
  v_cmd json; v_hash text; v_order text[]; v_unique int; v_member_count int;
  v_result jsonb; v_is_a boolean;
  v_gate json;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED'); end if;
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup from public.team_tournament_matchups
  where team_tournament_id = v_header.id and external_matchup_id = p_matchup_id;
  if v_matchup.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;

  select * into v_team from public.team_tournament_teams
  where team_tournament_id = v_header.id and external_team_id = p_team_id;
  if v_team.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;

  if public.team_tournament_can_manage() or public.team_tournament_can_manage_results() then
    null;
  else
    v_gate := public.team_tournament_guard_captain_portal_write(v_header, p_team_id);
    if not coalesce((v_gate->>'ok')::boolean, false) then
      return v_gate;
    end if;
  end if;

  if to_regclass('public.team_tournament_dreambreaker_states') is null then
    return json_build_object('ok', false, 'code', 'NOT_ACTIVATED', 'error', 'Dreambreaker chưa sẵn sàng.');
  end if;

  select * into v_db from public.team_tournament_dreambreaker_states where matchup_id = v_matchup.id;
  if v_db.id is null then return json_build_object('ok', false, 'code', 'NOT_ACTIVATED', 'error', 'Dreambreaker chưa kích hoạt.'); end if;
  if v_db.status <> 'lineup_open' then return json_build_object('ok', false, 'code', 'LOCKED', 'error', 'Dreambreaker không nhận order.'); end if;
  if v_db.orders_locked_at is not null then return json_build_object('ok', false, 'code', 'LOCKED'); end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'submit_dreambreaker_order', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'teamId', p_team_id, 'order', p_order, 'expectedVersion', p_expected_version)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  if p_expected_version is not null and v_db.version <> p_expected_version then
    return public.team_tournament_version_conflict('team_tournament_dreambreaker_states', p_expected_version, v_db.version);
  end if;

  select coalesce(array_agg(x), '{}') into v_order
  from jsonb_array_elements_text(coalesce(p_order, '[]'::jsonb)) as t(x);
  if coalesce(array_length(v_order, 1), 0) <> 4 then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Cần đúng 4 VĐV.');
  end if;
  select count(distinct u) into v_unique from unnest(v_order) u;
  if v_unique <> 4 then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Thứ tự không được trùng.');
  end if;
  select count(*) into v_member_count
  from unnest(v_order) u
  join public.team_tournament_team_members m
    on m.team_id = v_team.id and m.player_id = u;
  if v_member_count <> 4 then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'VĐV phải thuộc đội.');
  end if;

  v_is_a := p_team_id = v_matchup.team_a_id;
  update public.team_tournament_dreambreaker_states set
    team_a_order = case when v_is_a then to_jsonb(v_order) else team_a_order end,
    team_b_order = case when v_is_a then team_b_order else to_jsonb(v_order) end,
    order_source_a = case when v_is_a then 'captain' else order_source_a end,
    order_source_b = case when v_is_a then order_source_b else 'captain' end,
    status = case
      when jsonb_array_length(case when v_is_a then to_jsonb(v_order) else team_a_order end) = 4
       and jsonb_array_length(case when v_is_a then team_b_order else to_jsonb(v_order) end) = 4
      then 'ready' else 'lineup_open' end,
    version = version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_db.id
  returning * into v_db;

  v_result := jsonb_build_object('ok', true, 'version', v_db.version, 'status', v_db.status,
    'teamAOrder', v_db.team_a_order, 'teamBOrder', v_db.team_b_order);
  perform public.team_tournament_write_audit(v_header.tenant_id, v_header.tournament_id,
    'team.match.dreambreaker.order_submit', p_matchup_id, v_result);
  perform public.team_tournament_finish_command(v_header.tenant_id, p_tournament_id,
    'submit_dreambreaker_order', p_idempotency_key, v_hash, v_result);
  return v_result;
end;
$$;

-- G. Grants: authenticated only; anon denied
revoke all on function public.team_tournament_captain_access_enabled(jsonb) from public, anon;
grant execute on function public.team_tournament_captain_access_enabled(jsonb) to authenticated;

revoke all on function public.team_tournament_assert_captain_portal_access(text, text) from public, anon;
grant execute on function public.team_tournament_assert_captain_portal_access(text, text) to authenticated;

revoke all on function public.team_tournament_guard_captain_portal_write(public.team_tournaments, text) from public, anon, authenticated;

revoke all on function public.team_tournament_set_captain_access(text, boolean, integer, text) from public, anon;
grant execute on function public.team_tournament_set_captain_access(text, boolean, integer, text) to authenticated;

revoke all on function public.team_tournament_get_captain_portal(text, integer) from public, anon;
grant execute on function public.team_tournament_get_captain_portal(text, integer) to authenticated;

revoke all on function public.team_tournament_save_lineup_draft_legacy(text, text, text, jsonb) from public, anon;
grant execute on function public.team_tournament_save_lineup_draft_legacy(text, text, text, jsonb) to authenticated;

revoke all on function public.team_tournament_get_visible_lineups(text, text, text) from public, anon;
grant execute on function public.team_tournament_get_visible_lineups(text, text, text) to authenticated;

revoke all on function public.team_tournament_submit_dreambreaker_order(text, text, text, jsonb, integer, text) from public, anon;
grant execute on function public.team_tournament_submit_dreambreaker_order(text, text, text, jsonb, integer, text) to authenticated;

notify pgrst, 'reload schema';
