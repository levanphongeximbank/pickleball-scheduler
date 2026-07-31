-- Phase TT-5B — Provision + revoke RPCs
-- Staging only | depends on TT5-B_BRIDGE_SCHEMA.sql

-- ═══════════════════════════════════════════════════════════════════
-- 1. Build minimal V5 state shell from published lineup snapshot
-- ═══════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════
-- 2. Eligibility helper (read-only)
-- ═══════════════════════════════════════════════════════════════════
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

  if v_assignment.status <> 'active' then
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

-- ═══════════════════════════════════════════════════════════════════
-- 3. Provision RPC
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_provision_referee_match(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_referee_assignment_id uuid,
  p_expected_sub_match_version integer default null,
  p_idempotency_key text default null,
  p_reason text default 'tt5b_provision',
  p_source text default 'btc'
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
  v_assignment public.referee_assignments;
  v_cmd json;
  v_hash text;
  v_elig jsonb;
  v_players_a text[];
  v_players_b text[];
  v_discipline record;
  v_match_type text;
  v_state jsonb;
  v_state_id text;
  v_link public.team_sub_match_referee_links;
  v_now timestamptz := now();
  v_snapshot jsonb;
  v_result jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Chỉ BTC/Director được provision.');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'cross_tenant_denied');
  end;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'provision_referee_match', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id,
      'subMatchId', p_sub_match_id,
      'assignmentId', p_referee_assignment_id,
      'expectedVersion', p_expected_sub_match_version,
      'reason', p_reason,
      'source', p_source
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id and sm.external_sub_match_id = p_sub_match_id;

  v_elig := public.team_tournament_provision_eligibility(
    v_header, v_matchup, v_sub_match, p_referee_assignment_id
  );
  if not (v_elig->>'eligible')::boolean then
    return json_build_object(
      'ok', false,
      'code', coalesce(v_elig->>'blockCode', 'NOT_ELIGIBLE'),
      'error', v_elig->>'blockMessage'
    );
  end if;

  if p_expected_sub_match_version is not null and v_sub_match.version <> p_expected_sub_match_version then
    return public.team_tournament_version_conflict(
      'team_tournament_sub_matches', p_expected_sub_match_version, v_sub_match.version
    );
  end if;

  select * into v_assignment from public.referee_assignments where id = p_referee_assignment_id;

  select coalesce(array_agg(le.player_id order by le.sort_order, le.player_id), '{}')
  into v_players_a
  from public.team_tournament_lineups l
  join public.team_tournament_lineup_entries le on le.lineup_id = l.id
  where l.matchup_id = v_matchup.id
    and l.team_external_id = v_matchup.team_a_id
    and le.discipline_external_id = v_sub_match.discipline_external_id;

  select coalesce(array_agg(le.player_id order by le.sort_order, le.player_id), '{}')
  into v_players_b
  from public.team_tournament_lineups l
  join public.team_tournament_lineup_entries le on le.lineup_id = l.id
  where l.matchup_id = v_matchup.id
    and l.team_external_id = v_matchup.team_b_id
    and le.discipline_external_id = v_sub_match.discipline_external_id;

  select * into v_discipline
  from public.team_tournament_disciplines d
  where d.team_tournament_id = v_header.id
    and d.external_discipline_id = v_sub_match.discipline_external_id;

  v_match_type := coalesce(v_elig->>'matchType', 'doubles');
  v_state := public.team_tournament_build_v5_state_shell(
    v_sub_match.external_sub_match_id,
    v_matchup.team_a_id,
    v_matchup.team_b_id,
    v_players_a,
    v_players_b,
    v_match_type,
    coalesce(v_discipline.scoring_format, '{}'::jsonb)
  );

  v_state_id := public.referee_v5_match_state_id(
    v_header.tenant_id, v_header.tournament_id, v_sub_match.external_sub_match_id
  );

  if exists (
    select 1 from public.match_live_states mls
    where mls.id = v_state_id
      and (mls.tenant_id <> v_header.tenant_id or mls.match_id <> v_sub_match.external_sub_match_id)
  ) then
    return json_build_object('ok', false, 'code', 'referee_match_id_conflict');
  end if;

  if exists (
    select 1 from public.match_live_states mls
    where mls.id = v_state_id and mls.last_event_sequence > 0
  ) then
    return json_build_object(
      'ok', false,
      'code', 'referee_match_already_active',
      'error', 'V5 match đã có event history.'
    );
  end if;

  if not exists (select 1 from public.match_live_states where id = v_state_id) then
    insert into public.match_live_states (
      id, tenant_id, tournament_id, match_id,
      team_a_id, team_b_id,
      state_payload, state_version, version, status, last_event_sequence,
      participants, scoring_format, points_to_win, win_by, best_of, scoring_system
    ) values (
      v_state_id,
      v_header.tenant_id,
      v_header.tournament_id,
      v_sub_match.external_sub_match_id,
      v_matchup.team_a_id,
      v_matchup.team_b_id,
      v_state,
      0,
      0,
      'not_started',
      0,
      coalesce(v_state->'teams', '[]'::jsonb),
      coalesce(v_discipline.scoring_format, '{}'::jsonb),
      coalesce((v_state->>'pointsToWin')::int, 11),
      coalesce((v_state->>'winBy')::int, 2),
      1,
      coalesce(v_state->>'scoringFormat', 'side_out')
    );
  end if;

  v_snapshot := jsonb_build_object(
    'lineupAVersion', v_elig->'lineupAVersion',
    'lineupBVersion', v_elig->'lineupBVersion',
    'matchupVersion', v_matchup.version,
    'subMatchVersion', v_sub_match.version,
    'disciplineId', v_sub_match.discipline_external_id,
    'matchType', v_match_type,
    'courtLabel', v_matchup.schedule_meta->>'courtLabel',
    'provisionSource', p_source
  );

  insert into public.team_sub_match_referee_links (
    tenant_id, tournament_id, team_tournament_id,
    matchup_id, external_matchup_id,
    sub_match_id, external_sub_match_id,
    referee_match_id, referee_assignment_id,
    status, provision_version, provisioned_at, linked_at,
    snapshot, created_by, version
  ) values (
    v_header.tenant_id, v_header.tournament_id, v_header.id,
    v_matchup.id, v_matchup.external_matchup_id,
    v_sub_match.id, v_sub_match.external_sub_match_id,
    v_sub_match.external_sub_match_id,
    v_assignment.id,
    'provisioned', 1, v_now, v_now,
    v_snapshot, auth.uid(), 1
  )
  returning * into v_link;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.referee_v5.provision', v_sub_match.external_sub_match_id,
    jsonb_build_object(
      'linkId', v_link.id,
      'assignmentId', v_assignment.id,
      'matchStateId', v_state_id
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'replayed', false,
    'linkId', v_link.id,
    'externalSubMatchId', v_sub_match.external_sub_match_id,
    'refereeMatchId', v_sub_match.external_sub_match_id,
    'refereeAssignmentId', v_assignment.id,
    'matchStateId', v_state_id,
    'status', v_link.status,
    'version', v_link.version,
    'provisionedAt', v_link.provisioned_at,
    'route', '/referee/match/' || v_sub_match.external_sub_match_id
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'provision_referee_match',
    p_idempotency_key, v_hash, v_result
  );

  return v_result;
exception
  when unique_violation then
    select * into v_link
    from public.team_sub_match_referee_links l
    where l.sub_match_id = v_sub_match.id and l.status <> 'revoked';

    if v_link.id is not null then
      return json_build_object(
        'ok', true,
        'replayed', true,
        'linkId', v_link.id,
        'externalSubMatchId', v_link.external_sub_match_id,
        'refereeMatchId', v_link.referee_match_id,
        'status', v_link.status,
        'route', '/referee/match/' || v_link.referee_match_id
      );
    end if;
    return json_build_object('ok', false, 'code', 'duplicate_link_conflict');
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Revoke RPC (before active/finalized)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_revoke_referee_link(
  p_tournament_id text,
  p_sub_match_id text,
  p_reason text,
  p_expected_link_version integer default null,
  p_idempotency_key text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_sub_match public.team_tournament_sub_matches;
  v_link public.team_sub_match_referee_links;
  v_cmd json;
  v_hash text;
  v_state_id text;
  v_events bigint;
  v_result jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if coalesce(trim(p_reason), '') = '' then
    return json_build_object('ok', false, 'code', 'revoke_reason_required');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'revoke_referee_link', p_idempotency_key,
    jsonb_build_object('subMatchId', p_sub_match_id, 'reason', p_reason, 'expectedVersion', p_expected_link_version)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  select sm.* into v_sub_match
  from public.team_tournament_sub_matches sm
  join public.team_tournament_matchups m on m.id = sm.matchup_id
  where m.team_tournament_id = v_header.id and sm.external_sub_match_id = p_sub_match_id;

  select * into v_link
  from public.team_sub_match_referee_links l
  where l.sub_match_id = v_sub_match.id and l.status <> 'revoked';

  if v_link.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không có link active.');
  end if;

  if p_expected_link_version is not null and v_link.version <> p_expected_link_version then
    return public.team_tournament_version_conflict(
      'team_sub_match_referee_links', p_expected_link_version, v_link.version
    );
  end if;

  if v_link.status in ('active', 'finalized') then
    return json_build_object(
      'ok', false,
      'code', 'referee_v5_result_finalized',
      'error', 'Không thể revoke sau khi active/finalized.'
    );
  end if;

  v_state_id := public.referee_v5_match_state_id(
    v_header.tenant_id, v_header.tournament_id, v_link.referee_match_id
  );

  select coalesce(last_event_sequence, 0) into v_events
  from public.match_live_states where id = v_state_id;

  if coalesce(v_events, 0) > 0 then
    return json_build_object(
      'ok', false,
      'code', 'referee_v5_match_active',
      'error', 'V5 match đã có event history — không thể revoke.'
    );
  end if;

  update public.team_sub_match_referee_links set
    status = 'revoked',
    revoke_reason = p_reason,
    revoked_at = now(),
    revoked_by = auth.uid(),
    version = version + 1,
    updated_at = now()
  where id = v_link.id;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.referee_v5.revoke', v_link.external_sub_match_id,
    jsonb_build_object('linkId', v_link.id, 'reason', p_reason)
  );

  v_result := jsonb_build_object(
    'ok', true,
    'linkId', v_link.id,
    'status', 'revoked',
    'version', v_link.version + 1
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'revoke_referee_link',
    p_idempotency_key, v_hash, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.team_tournament_provision_referee_match(
  text, text, text, uuid, integer, text, text, text
) from public;
grant execute on function public.team_tournament_provision_referee_match(
  text, text, text, uuid, integer, text, text, text
) to authenticated;

revoke all on function public.team_tournament_revoke_referee_link(
  text, text, text, integer, text
) from public;
grant execute on function public.team_tournament_revoke_referee_link(
  text, text, text, integer, text
) to authenticated;

grant execute on function public.team_tournament_provision_eligibility(
  public.team_tournaments, public.team_tournament_matchups,
  public.team_tournament_sub_matches, uuid
) to authenticated;

grant execute on function public.team_tournament_build_v5_state_shell(
  text, text, text, text[], text[], text, jsonb
) to authenticated;
