-- R2-2G — Fix P0-06 Team Tournament → Referee V5 provision scoring map
-- Staging only. Replaces team_tournament_build_v5_state_shell + patches provision insert.
-- Override order at provision: tournament settings.scoringFormat → discipline.scoring_format
-- (sub-match override is applied client-side into discipline before save when needed).

-- ═══════════════════════════════════════════════════════════════════
-- 1. Resolve TT scoring JSON → V5 shell format fields
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_resolve_v5_scoring_map(
  p_scoring_format jsonb,
  p_match_type text
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_fmt jsonb := coalesce(p_scoring_format, '{}'::jsonb);
  v_system text := lower(coalesce(
    nullif(v_fmt->>'scoringSystem', ''),
    nullif(v_fmt->>'scoringFormat', ''),
    'side_out'
  ));
  v_variant text := coalesce(nullif(v_fmt->>'scoringVariant', ''), '');
  v_match_type text := lower(coalesce(nullif(p_match_type, ''), 'doubles'));
  v_points int;
  v_win_by int;
  v_best_of int;
  v_freeze_at text := nullif(v_fmt->>'freezeAt', '');
  v_freeze_rule text := upper(coalesce(nullif(v_fmt->>'freezeRule', ''), 'NONE'));
  v_match_format text := lower(coalesce(nullif(v_fmt->>'matchFormat', ''), ''));
begin
  if v_system in ('rally', 'r') then
    v_system := 'rally';
  elsif v_system in ('side_out', 'sideout', 'side-out', 's') then
    v_system := 'side_out';
  else
    v_system := 'side_out';
  end if;

  v_points := coalesce(
    (nullif(v_fmt->>'pointsToWin', ''))::int,
    (nullif(v_fmt->>'targetScore', ''))::int,
    11
  );
  v_win_by := coalesce((nullif(v_fmt->>'winBy', ''))::int, 2);

  if coalesce(nullif(v_fmt->>'bestOf', ''), '') ~ '^[0-9]+$' then
    v_best_of := (v_fmt->>'bestOf')::int;
  elsif v_match_format in ('best_of_3', 'bo3') or v_fmt->>'bestOf' = 'best_of_3' then
    v_best_of := 3;
  elsif v_match_format in ('best_of_5', 'bo5') then
    v_best_of := 5;
  else
    v_best_of := 1;
  end if;

  if v_system = 'rally' then
    -- Reject MLP / freeze / DreamBreaker-adjacent / singles Rally (R2-2G scope).
    if v_match_type = 'singles' then
      return jsonb_build_object(
        'ok', false,
        'code', 'UNSUPPORTED_SCORING_VARIANT',
        'error', 'USAP 2026 Provisional Rally chỉ hỗ trợ doubles trong R2-2G.'
      );
    end if;

    if v_freeze_at is not null and v_freeze_at not in ('null', '') then
      return jsonb_build_object(
        'ok', false,
        'code', 'UNSUPPORTED_SCORING_VARIANT',
        'error', 'Freeze-enabled / MLP Rally chưa được hỗ trợ qua Referee V5.'
      );
    end if;

    if v_freeze_rule is distinct from 'NONE' then
      return jsonb_build_object(
        'ok', false,
        'code', 'UNSUPPORTED_SCORING_VARIANT',
        'error', 'freezeRule phải là NONE cho USAP 2026 Provisional Rally.'
      );
    end if;

    if v_variant <> '' and v_variant <> 'USAP_2026_PROVISIONAL_RALLY' then
      return jsonb_build_object(
        'ok', false,
        'code', 'UNSUPPORTED_SCORING_VARIANT',
        'error', 'Biến thể Rally không hỗ trợ: ' || v_variant
      );
    end if;

    if v_match_format like '%dream%' or v_match_format like '%mlp%' then
      return jsonb_build_object(
        'ok', false,
        'code', 'UNSUPPORTED_SCORING_VARIANT',
        'error', 'MLP / DreamBreaker Rally không hỗ trợ trong R2-2G.'
      );
    end if;

    if v_points is distinct from 11 or v_win_by is distinct from 2 then
      return jsonb_build_object(
        'ok', false,
        'code', 'UNSUPPORTED_SCORING_VARIANT',
        'error', 'USAP 2026 Provisional Rally cố định 11 / win-by-2 trong R2-2G.'
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'scoringFormat', 'rally',
      'scoringSystem', 'RALLY',
      'scoringVariant', 'USAP_2026_PROVISIONAL_RALLY',
      'ruleSetId', 'rally_usap_2026_provisional_doubles_v1',
      'pointsToWin', 11,
      'winBy', 2,
      'bestOf', v_best_of,
      'freezeRule', 'NONE',
      'serverNumberRule', 'NONE',
      'serverNumber', null,
      'matchType', 'doubles'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'scoringFormat', 'side_out',
    'scoringSystem', 'SIDE_OUT',
    'scoringVariant', case
      when v_match_type = 'singles' then 'SIDE_OUT_SINGLES_V1'
      else 'SIDE_OUT_DOUBLES_V1'
    end,
    'ruleSetId', case
      when v_match_type = 'singles' then 'side_out_singles_v1'
      else 'side_out_doubles_v1'
    end,
    'pointsToWin', v_points,
    'winBy', v_win_by,
    'bestOf', v_best_of,
    'freezeRule', null,
    'serverNumberRule', null,
    'serverNumber', case when v_match_type = 'singles' then null else 1 end,
    'matchType', v_match_type
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Build V5 state shell (P0-06: maps scoringSystem/targetScore)
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
  v_map jsonb;
  v_match_type text;
  v_players_a jsonb := '[]'::jsonb;
  v_players_b jsonb := '[]'::jsonb;
  v_first_server text;
  v_sides text[] := array['RIGHT_SERVICE_COURT', 'LEFT_SERVICE_COURT'];
  i int;
  v_state jsonb;
begin
  v_map := public.team_tournament_resolve_v5_scoring_map(p_scoring_format, p_match_type);
  if not coalesce((v_map->>'ok')::boolean, false) then
    return v_map;
  end if;

  v_match_type := coalesce(v_map->>'matchType', lower(coalesce(p_match_type, 'doubles')));

  if v_match_type = 'singles' then
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

  v_state := jsonb_build_object(
    'matchId', p_match_id,
    'matchType', v_match_type,
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
    'scoringFormat', v_map->>'scoringFormat',
    'scoringSystem', v_map->>'scoringSystem',
    'scoringVariant', v_map->>'scoringVariant',
    'ruleSetId', v_map->>'ruleSetId',
    'pointsToWin', (v_map->>'pointsToWin')::int,
    'winBy', (v_map->>'winBy')::int,
    'bestOf', (v_map->>'bestOf')::int
  );

  -- jsonb_build_object drops SQL NULLs; Rally requires explicit serverNumber:null.
  if (v_map->>'scoringSystem') = 'RALLY' then
    v_state := v_state
      || '{"serverNumber": null, "maximumScore": null, "freezeRule": "NONE", "serverNumberRule": "NONE"}'::jsonb;
  else
    v_state := v_state || jsonb_build_object(
      'serverNumber', case when v_match_type = 'singles' then null else 1 end,
      'maximumScore', null
    );
    -- singles: force null serverNumber (jsonb_build_object may drop it)
    if v_match_type = 'singles' then
      v_state := v_state || '{"serverNumber": null}'::jsonb;
    end if;
  end if;

  return v_state || jsonb_build_object('ok', true);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Provision RPC — merge tournament+discipline; fail unsupported; map columns
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
  v_scoring_format jsonb;
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

  -- tournament default ← overridden by → discipline (sub-match override applied client-side)
  v_scoring_format := coalesce(v_header.settings->'scoringFormat', '{}'::jsonb)
    || coalesce(v_discipline.scoring_format, '{}'::jsonb);

  v_state := public.team_tournament_build_v5_state_shell(
    v_sub_match.external_sub_match_id,
    v_matchup.team_a_id,
    v_matchup.team_b_id,
    v_players_a,
    v_players_b,
    v_match_type,
    v_scoring_format
  );

  if v_state ? 'ok' and not coalesce((v_state->>'ok')::boolean, false) then
    return json_build_object(
      'ok', false,
      'code', coalesce(v_state->>'code', 'UNSUPPORTED_SCORING_VARIANT'),
      'error', coalesce(v_state->>'error', 'Unsupported scoring format for Referee V5.')
    );
  end if;

  -- strip helper ok flag before persist
  v_state := v_state - 'ok';

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
      jsonb_build_object(
        'scoringSystem', v_state->>'scoringSystem',
        'scoringVariant', v_state->>'scoringVariant',
        'scoringFormat', v_state->>'scoringFormat',
        'ruleSetId', v_state->>'ruleSetId',
        'pointsToWin', (v_state->>'pointsToWin')::int,
        'winBy', (v_state->>'winBy')::int,
        'bestOf', (v_state->>'bestOf')::int,
        'freezeRule', v_state->>'freezeRule',
        'serverNumberRule', v_state->>'serverNumberRule'
      ),
      coalesce((v_state->>'pointsToWin')::int, 11),
      coalesce((v_state->>'winBy')::int, 2),
      coalesce((v_state->>'bestOf')::int, 1),
      -- Column check allows only lowercase: side_out | rally
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
    'scoringSystem', v_state->>'scoringSystem',
    'scoringVariant', v_state->>'scoringVariant',
    'pointsToWin', (v_state->>'pointsToWin')::int,
    'winBy', (v_state->>'winBy')::int,
    'bestOf', (v_state->>'bestOf')::int,
    'courtLabel', v_matchup.schedule_meta->>'courtLabel',
    'provisionSource', p_source,
    'phase', 'R2-2G'
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
      'matchStateId', v_state_id,
      'scoringSystem', v_state->>'scoringSystem',
      'scoringVariant', v_state->>'scoringVariant'
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
    'scoringSystem', v_state->>'scoringSystem',
    'scoringVariant', v_state->>'scoringVariant',
    'pointsToWin', (v_state->>'pointsToWin')::int,
    'winBy', (v_state->>'winBy')::int,
    'bestOf', (v_state->>'bestOf')::int,
    'route', '/referee/match/' || v_sub_match.external_sub_match_id
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'provision_referee_match',
    p_idempotency_key, v_hash, v_result
  );

  return v_result;
exception when unique_violation then
  -- Idempotent retry: link already exists for external_sub_match_id
  select * into v_link
  from public.team_sub_match_referee_links
  where tenant_id = v_header.tenant_id
    and tournament_id = v_header.tournament_id
    and external_sub_match_id = p_sub_match_id
  order by provisioned_at desc nulls last
  limit 1;

  if v_link.id is null then
    return json_build_object('ok', false, 'code', 'PROVISION_UNIQUE_CONFLICT');
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'replayed', true,
    'linkId', v_link.id,
    'externalSubMatchId', v_link.external_sub_match_id,
    'refereeMatchId', v_link.referee_match_id,
    'status', v_link.status,
    'duplicatePrevented', true
  );

  if p_idempotency_key is not null and v_hash is not null then
    perform public.team_tournament_finish_command(
      v_header.tenant_id, p_tournament_id, 'provision_referee_match',
      p_idempotency_key, v_hash, v_result
    );
  end if;

  return v_result;
end;
$$;

grant execute on function public.team_tournament_resolve_v5_scoring_map(jsonb, text) to authenticated;
grant execute on function public.team_tournament_build_v5_state_shell(
  text, text, text, text[], text[], text, jsonb
) to authenticated;
grant execute on function public.team_tournament_provision_referee_match(
  text, text, text, uuid, integer, text, text, text
) to authenticated;
