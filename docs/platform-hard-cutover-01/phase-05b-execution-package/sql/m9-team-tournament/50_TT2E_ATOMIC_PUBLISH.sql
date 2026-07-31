-- Phase TT-2E — Atomic publish workflow for team tournament matchups
-- Prerequisite: PHASE_23C + TT-1B + TT-2B + TT-2C + TT-2D on staging
-- Safe to re-run (create or replace). Staging only.

-- ─── Publish readiness helper ───
create or replace function public.team_tournament_matchup_publish_ops(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_lineup_ops jsonb;
  v_lineup_a public.team_tournament_lineups;
  v_lineup_b public.team_tournament_lineups;
  v_can_publish boolean := false;
  v_block_code text := null;
  v_block_message text := null;
begin
  if p_matchup.status in ('published', 'in_progress', 'completed') then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'already_published',
      'blockMessage', 'Matchup đã được công bố.',
      'matchupStatus', p_matchup.status,
      'matchupVersion', p_matchup.version,
      'publishedAt', p_matchup.updated_at
    );
  end if;

  if p_matchup.status <> 'locked' then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'matchup_not_locked',
      'blockMessage', 'Matchup chưa khóa — không thể công bố.',
      'matchupStatus', p_matchup.status,
      'matchupVersion', p_matchup.version
    );
  end if;

  select * into v_lineup_a
  from public.team_tournament_lineups l
  where l.matchup_id = p_matchup.id
    and l.team_external_id = p_matchup.team_a_id;

  select * into v_lineup_b
  from public.team_tournament_lineups l
  where l.matchup_id = p_matchup.id
    and l.team_external_id = p_matchup.team_b_id;

  if v_lineup_a.id is null or v_lineup_b.id is null then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'lineup_missing',
      'blockMessage', 'Thiếu đội hình một hoặc cả hai đội.',
      'matchupVersion', p_matchup.version,
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version,
      'teamAId', p_matchup.team_a_id,
      'teamBId', p_matchup.team_b_id
    );
  end if;

  if v_lineup_a.status <> 'locked' or v_lineup_b.status <> 'locked' then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'lineup_not_locked',
      'blockMessage', 'Cả hai đội hình phải ở trạng thái locked trước khi công bố.',
      'matchupVersion', p_matchup.version,
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version,
      'lineupAStatus', v_lineup_a.status,
      'lineupBStatus', v_lineup_b.status
    );
  end if;

  if coalesce(v_lineup_a.audit_note, '') like 'tt2d:manual_pending%'
     or coalesce(v_lineup_b.audit_note, '') like 'tt2d:manual_pending%' then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'manual_pending',
      'blockMessage', 'Còn đội hình chờ xử lý thủ công (manual_pending).',
      'matchupVersion', p_matchup.version,
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version
    );
  end if;

  v_lineup_ops := public.team_tournament_matchup_lineup_ops(p_header, p_matchup, p_now);

  if jsonb_array_length(coalesce(v_lineup_ops->'unhandledMissingTeamIds', '[]'::jsonb)) > 0 then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'missing_policy_unresolved',
      'blockMessage', 'Chính sách thiếu lineup chưa được xử lý.',
      'matchupVersion', p_matchup.version,
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version,
      'unhandledMissingTeamIds', v_lineup_ops->'unhandledMissingTeamIds',
      'lineupOps', v_lineup_ops
    );
  end if;

  v_can_publish := true;

  return jsonb_build_object(
    'canPublish', v_can_publish,
    'blockCode', v_block_code,
    'blockMessage', v_block_message,
    'matchupStatus', p_matchup.status,
    'matchupVersion', p_matchup.version,
    'lineupAVersion', v_lineup_a.version,
    'lineupBVersion', v_lineup_b.version,
    'teamAId', p_matchup.team_a_id,
    'teamBId', p_matchup.team_b_id,
    'lineupAStatus', v_lineup_a.status,
    'lineupBStatus', v_lineup_b.status,
    'lineupOps', v_lineup_ops
  );
end;
$$;

-- ─── Atomic publish core (TT-2E) ───
create or replace function public.team_tournament_publish_matchup(
  p_tournament_id text,
  p_matchup_id text,
  p_expected_matchup_version integer,
  p_expected_lineup_a_version integer,
  p_expected_lineup_b_version integer,
  p_idempotency_key text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_lineup_a public.team_tournament_lineups;
  v_lineup_b public.team_tournament_lineups;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_ops jsonb;
  v_pub timestamptz := now();
  v_before jsonb;
  v_actor_role text;
  v_replayed boolean := false;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not (public.team_tournament_can_manage() or public.user_has_permission('team.lineup.publish')) then
    return json_build_object('ok', false, 'code', 'publish_forbidden', 'message', 'Không có quyền công bố đội hình.');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception
    when others then
      return json_build_object('ok', false, 'code', 'cross_tenant_denied', 'message', 'Không có quyền tenant.');
  end;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'publish_matchup', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id,
      'expectedMatchupVersion', p_expected_matchup_version,
      'expectedLineupAVersion', p_expected_lineup_a_version,
      'expectedLineupBVersion', p_expected_lineup_b_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then
    v_replayed := true;
    return v_cmd->'result';
  end if;
  v_hash := v_cmd->>'payload_hash';

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id
  for update;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_matchup.status in ('published', 'in_progress', 'completed') then
    return json_build_object(
      'ok', false,
      'code', 'already_published',
      'message', 'Matchup đã được công bố.',
      'matchupVersion', v_matchup.version
    );
  end if;

  if p_expected_matchup_version is not null and v_matchup.version <> p_expected_matchup_version then
    return public.team_tournament_version_conflict(
      'team_tournament_matchups', p_expected_matchup_version, v_matchup.version
    );
  end if;

  if v_matchup.status <> 'locked' then
    return json_build_object(
      'ok', false,
      'code', 'matchup_not_locked',
      'message', 'Matchup chưa khóa.',
      'matchupVersion', v_matchup.version
    );
  end if;

  select * into v_lineup_a
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id
    and l.team_external_id = v_matchup.team_a_id
  for update;

  select * into v_lineup_b
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id
    and l.team_external_id = v_matchup.team_b_id
  for update;

  if v_lineup_a.id is null or v_lineup_b.id is null then
    return json_build_object('ok', false, 'code', 'lineup_missing', 'message', 'Thiếu đội hình.');
  end if;

  if p_expected_lineup_a_version is not null and v_lineup_a.version <> p_expected_lineup_a_version then
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_lineup_a_version, v_lineup_a.version
    );
  end if;

  if p_expected_lineup_b_version is not null and v_lineup_b.version <> p_expected_lineup_b_version then
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_lineup_b_version, v_lineup_b.version
    );
  end if;

  v_ops := public.team_tournament_matchup_publish_ops(v_header, v_matchup, v_pub);

  if not coalesce((v_ops->>'canPublish')::boolean, false) then
    return json_build_object(
      'ok', false,
      'code', coalesce(v_ops->>'blockCode', 'CANNOT_PUBLISH'),
      'message', coalesce(v_ops->>'blockMessage', 'Chưa đủ điều kiện công bố.'),
      'publishOps', v_ops
    );
  end if;

  v_before := jsonb_build_object(
    'matchupStatus', v_matchup.status,
    'matchupVersion', v_matchup.version,
    'lineupA', jsonb_build_object('status', v_lineup_a.status, 'version', v_lineup_a.version),
    'lineupB', jsonb_build_object('status', v_lineup_b.status, 'version', v_lineup_b.version)
  );

  update public.team_tournament_lineups l
  set status = 'published',
      published_at = v_pub,
      version = l.version + 1,
      updated_at = v_pub,
      updated_by = auth.uid()
  where l.id in (v_lineup_a.id, v_lineup_b.id)
    and l.status = 'locked';

  if (
    select count(*)::int from public.team_tournament_lineups
    where id in (v_lineup_a.id, v_lineup_b.id) and status = 'published'
  ) <> 2 then
    raise exception 'TT2E publish partial lineup update blocked';
  end if;

  update public.team_tournament_matchups m
  set status = 'published',
      version = m.version + 1,
      updated_at = v_pub,
      updated_by = auth.uid()
  where m.id = v_matchup.id
    and m.status = 'locked'
    and (p_expected_matchup_version is null or m.version = p_expected_matchup_version);

  if not found then
    raise exception 'TT2E publish partial matchup update blocked';
  end if;

  select l.version into v_lineup_a.version from public.team_tournament_lineups l where l.id = v_lineup_a.id;
  select l.version into v_lineup_b.version from public.team_tournament_lineups l where l.id = v_lineup_b.id;
  select m.version into v_matchup.version from public.team_tournament_matchups m where m.id = v_matchup.id;

  v_actor_role := case
    when public.team_tournament_can_manage() then 'btc'
    when public.user_has_permission('team.lineup.publish') then 'organizer'
    else 'unknown'
  end;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id, 'team.lineup.publish', p_matchup_id,
    jsonb_build_object(
      'actorUserId', auth.uid(),
      'actorRole', v_actor_role,
      'tenantId', v_header.tenant_id,
      'tournamentId', p_tournament_id,
      'matchupId', p_matchup_id,
      'teamAId', v_matchup.team_a_id,
      'teamBId', v_matchup.team_b_id,
      'before', v_before,
      'after', jsonb_build_object(
        'matchupStatus', 'published',
        'matchupVersion', v_matchup.version,
        'lineupA', jsonb_build_object('status', 'published', 'version', v_lineup_a.version),
        'lineupB', jsonb_build_object('status', 'published', 'version', v_lineup_b.version),
        'publishedAt', v_pub
      ),
      'requestId', p_idempotency_key,
      'idempotencyKey', p_idempotency_key,
      'serverTime', v_pub
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'published',
    'matchupVersion', v_matchup.version,
    'lineupAVersion', v_lineup_a.version,
    'lineupBVersion', v_lineup_b.version,
    'version', v_matchup.version,
    'publishedAt', v_pub,
    'replayed', v_replayed,
    'requestId', p_idempotency_key
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'publish_matchup', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

-- ─── TT-1B 4-param overload: delegate to atomic with DB-side lineup version enforcement ───
create or replace function public.team_tournament_publish_matchup(
  p_tournament_id text,
  p_matchup_id text,
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
  v_matchup public.team_tournament_matchups;
  v_lineup_a public.team_tournament_lineups;
  v_lineup_b public.team_tournament_lineups;
begin
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_lineup_a
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = v_matchup.team_a_id;

  select * into v_lineup_b
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = v_matchup.team_b_id;

  return public.team_tournament_publish_matchup(
    p_tournament_id,
    p_matchup_id,
    p_expected_version,
    v_lineup_a.version,
    v_lineup_b.version,
    p_idempotency_key
  );
end;
$$;

-- ─── Visible lineups: opponent only after matchup published ───
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

  select coalesce(json_object_agg(
    l.team_external_id,
    json_build_object(
      'matchupId', p_matchup_id,
      'teamId', l.team_external_id,
      'status', l.status,
      'selections', case
        when v_is_manage then l.selections
        when l.team_external_id = coalesce(p_viewer_team_id, '') then l.selections
        when v_can_results and v_matchup.status in ('published','in_progress','completed') then l.selections
        when v_matchup.status in ('published','in_progress','completed') then l.selections
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
      or l.team_external_id = coalesce(p_viewer_team_id, '')
      or (
        v_can_results
        and v_matchup.status in ('published','in_progress','completed')
      )
      or v_matchup.status in ('published','in_progress','completed')
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

-- ─── get_setup: publish ops per matchup for BTC ───
create or replace function public.team_tournament_get_setup(
  p_tournament_id text,
  p_viewer_team_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_player_id text;
  v_is_manage boolean;
  v_viewer_team_id text;
  v_teams json;
  v_disciplines json;
  v_matchups json;
  v_lineups json;
  v_standings json;
  v_server_time timestamptz := now();
  v_summary jsonb;
  v_lineup_deadline timestamptz;
  v_can_save_draft boolean := false;
  v_can_submit boolean := false;
  v_deadline_status text := 'locked';
  v_publish_ops jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy giải.');
  end if;

  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_player_id := public.team_tournament_user_player_id();
  v_is_manage := public.team_tournament_can_manage();

  v_viewer_team_id := nullif(trim(coalesce(p_viewer_team_id, '')), '');
  if v_viewer_team_id is null and v_player_id is not null then
    select t.external_team_id
    into v_viewer_team_id
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and (
        t.captain_player_id = v_player_id
        or v_player_id = any(coalesce(t.deputy_player_ids, '{}'::text[]))
      )
    order by t.created_at
    limit 1;
  end if;

  select coalesce(json_agg(json_build_object(
    'id', t.external_team_id,
    'name', t.name,
    'color', t.color,
    'logoUrl', t.logo_url,
    'captainPlayerId', t.captain_player_id,
    'deputyPlayerIds', t.deputy_player_ids,
    'playerIds', coalesce((
      select json_agg(m.player_id order by m.role desc, m.created_at)
      from public.team_tournament_team_members m where m.team_id = t.id
    ), '[]'::json),
    'absentPlayerIds', t.absent_player_ids,
    'lockedPlayerIds', t.locked_player_ids
  )), '[]'::json)
  into v_teams
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id;

  select coalesce(json_agg(json_build_object(
    'id', d.external_discipline_id,
    'name', d.name,
    'categoryType', d.category_type,
    'genderRequirement', d.gender_requirement,
    'playerCount', d.player_count,
    'sortOrder', d.sort_order,
    'scoringFormat', d.scoring_format,
    'countsTowardResult', d.counts_toward_result
  ) order by d.sort_order), '[]'::json)
  into v_disciplines
  from public.team_tournament_disciplines d
  where d.team_tournament_id = v_header.id;

  select coalesce(json_agg(
    json_build_object(
      'id', m.external_matchup_id,
      'teamAId', m.team_a_id,
      'teamBId', m.team_b_id,
      'scheduledAt', m.scheduled_at,
      'lineupLockAt', m.lineup_lock_at,
      'lineupDeadline', m.lineup_lock_at,
      'courtLabel', m.court_label,
      'status', m.status,
      'result', m.result,
      'version', m.version,
      'canSaveDraft', case
        when v_viewer_team_id is not null
          and v_viewer_team_id in (m.team_a_id, m.team_b_id)
        then (public.team_tournament_lineup_deadline_fields(
          m.lineup_lock_at,
          m.status,
          coalesce(vl.status, 'not_submitted'),
          vl.locked_at
        )->>'canSaveDraft')::boolean
        else null
      end,
      'canSubmit', case
        when v_viewer_team_id is not null
          and v_viewer_team_id in (m.team_a_id, m.team_b_id)
        then (public.team_tournament_lineup_deadline_fields(
          m.lineup_lock_at,
          m.status,
          coalesce(vl.status, 'not_submitted'),
          vl.locked_at
        )->>'canSubmit')::boolean
        else null
      end,
      'deadlineStatus', case
        when v_viewer_team_id is not null
          and v_viewer_team_id in (m.team_a_id, m.team_b_id)
        then public.team_tournament_lineup_deadline_fields(
          m.lineup_lock_at,
          m.status,
          coalesce(vl.status, 'not_submitted'),
          vl.locked_at
        )->>'deadlineStatus'
        else null
      end,
      'lineupOps', case when v_is_manage then public.team_tournament_matchup_lineup_ops(v_header, m, v_server_time) else null end,
      'canLock', case when v_is_manage then (public.team_tournament_matchup_lineup_ops(v_header, m, v_server_time)->>'canLock')::boolean else null end,
      'missingTeamIds', case when v_is_manage then public.team_tournament_matchup_lineup_ops(v_header, m, v_server_time)->'missingTeamIds' else null end,
      'canRandomizeTeamIds', case when v_is_manage then public.team_tournament_matchup_lineup_ops(v_header, m, v_server_time)->'canRandomizeTeamIds' else null end,
      'publishOps', case when v_is_manage then public.team_tournament_matchup_publish_ops(v_header, m, v_server_time) else null end,
      'canPublish', case when v_is_manage then (public.team_tournament_matchup_publish_ops(v_header, m, v_server_time)->>'canPublish')::boolean else null end,
      'publishBlockCode', case when v_is_manage then public.team_tournament_matchup_publish_ops(v_header, m, v_server_time)->>'blockCode' else null end,
      'publishBlockMessage', case when v_is_manage then public.team_tournament_matchup_publish_ops(v_header, m, v_server_time)->>'blockMessage' else null end,
      'lineupAVersion', case when v_is_manage then (public.team_tournament_matchup_publish_ops(v_header, m, v_server_time)->>'lineupAVersion')::int else null end,
      'lineupBVersion', case when v_is_manage then (public.team_tournament_matchup_publish_ops(v_header, m, v_server_time)->>'lineupBVersion')::int else null end,
      'publishedAt', case when m.status in ('published','in_progress','completed') then m.updated_at else null end,
      'missingLineupPolicy', public.team_tournament_normalize_missing_lineup_policy(v_header.settings->>'missingLineupPolicy'),
      'subMatches', coalesce((
        select json_agg(json_build_object(
          'id', sm.external_sub_match_id,
          'disciplineId', sm.discipline_external_id,
          'sortOrder', sm.sort_order,
          'status', sm.status,
          'score', sm.score,
          'winnerTeamId', sm.winner_team_id,
          'resultConfirmedAt', sm.result_confirmed_at
        ) order by sm.sort_order)
        from public.team_tournament_sub_matches sm
        where sm.matchup_id = m.id
      ), '[]'::json)
    )
    order by m.scheduled_at nulls last, m.external_matchup_id
  ), '[]'::json)
  into v_matchups
  from public.team_tournament_matchups m
  left join public.team_tournament_lineups vl
    on vl.matchup_id = m.id
   and vl.team_external_id = v_viewer_team_id
  where m.team_tournament_id = v_header.id;

  select coalesce(json_object_agg(
    m.external_matchup_id || '::' || l.team_external_id,
    json_build_object(
      'matchupId', m.external_matchup_id,
      'teamId', l.team_external_id,
      'status', l.status,
      'selections', case
        when v_is_manage then l.selections
        when l.team_external_id = coalesce(v_viewer_team_id, '') then l.selections
        when m.status in ('published','in_progress','completed') then l.selections
        else null
      end,
      'submittedAt', l.submitted_at,
      'lockedAt', l.locked_at,
      'publishedAt', l.published_at,
      'source', l.source,
      'auditNote', l.audit_note,
      'version', l.version
    )
  ), '{}'::json)
  into v_lineups
  from public.team_tournament_lineups l
  join public.team_tournament_matchups m on m.id = l.matchup_id
  where m.team_tournament_id = v_header.id
    and (
      v_is_manage
      or public.user_has_permission('team.view')
      or public.user_has_permission('team.standings.view')
      or public.team_tournament_can_manage_results()
      or l.team_external_id = coalesce(v_viewer_team_id, '')
      or m.status in ('published','in_progress','completed')
    );

  select coalesce(json_agg(json_build_object(
    'teamId', s.team_external_id,
    'rank', s.rank,
    'played', s.played,
    'wins', s.wins,
    'losses', s.losses,
    'subMatchWins', s.sub_match_wins,
    'subMatchLosses', s.sub_match_losses,
    'subMatchDiff', s.sub_match_diff,
    'pointsScored', s.points_scored,
    'pointsConceded', s.points_conceded,
    'rankingPoints', s.ranking_points
  ) order by s.rank), '[]'::json)
  into v_standings
  from public.team_tournament_standings s
  where s.team_tournament_id = v_header.id
    and (
      v_is_manage
      or public.user_has_permission('team.standings.view')
      or v_header.status in ('active','completed')
    );

  v_summary := public.team_tournament_captain_portal_summary(v_header, v_viewer_team_id, v_server_time);

  return json_build_object(
    'ok', true,
    'tournamentId', p_tournament_id,
    'tenantId', v_header.tenant_id,
    'clubId', v_header.club_id,
    'status', v_header.status,
    'settings', v_header.settings,
    'version', v_header.version,
    'serverTime', v_server_time,
    'viewerTeamId', v_viewer_team_id,
    'teams', v_teams,
    'disciplines', v_disciplines,
    'matchups', v_matchups,
    'lineups', v_lineups,
    'standings', v_standings,
    'summary', v_summary
  );
end;
$$;

-- ─── Grants ───
revoke all on function public.team_tournament_matchup_publish_ops(public.team_tournaments, public.team_tournament_matchups, timestamptz) from public;
revoke all on function public.team_tournament_publish_matchup(text, text, integer, integer, integer, text) from public;
revoke all on function public.team_tournament_publish_matchup(text, text, integer, text) from public;

grant execute on function public.team_tournament_matchup_publish_ops(public.team_tournaments, public.team_tournament_matchups, timestamptz) to authenticated;
grant execute on function public.team_tournament_publish_matchup(text, text, integer, integer, integer, text) to authenticated;
grant execute on function public.team_tournament_publish_matchup(text, text, integer, text) to authenticated;
grant execute on function public.team_tournament_get_visible_lineups(text, text, text) to authenticated;
grant execute on function public.team_tournament_get_setup(text, text) to authenticated;
