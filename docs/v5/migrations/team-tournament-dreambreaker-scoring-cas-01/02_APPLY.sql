-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-dreambreaker-scoring-cas-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-SCORING-CONFIG-CAS-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
--
-- Hardens public.team_tournament_record_dreambreaker_point only:
--   * DREAMBREAKER_SCORING_RESOLVE_01
--       1. matchup.schedule_meta.dreambreakerScoringFormat
--          or schedule_meta.dreambreaker.scoringFormat
--       2. catalog Dreambreaker scoring_format (same matcher as start)
--       3. canonical fallback targetScore=21 winBy=2 rotationPoints=4
--     targetPoints is an alias for targetScore.
--     21 is the DEFAULT, not the only allowed value.
--   * DREAMBREAKER_POINT_EXPECTED_VERSION_REQUIRED
--   * DREAMBREAKER_POINT_CAS_ATOMIC
--       UPDATE ... WHERE version = p_expected_version
--       CANONICAL_VERSION_AUTHORITY = dreambreaker_states.version
--   * submatch.version +1 only after accepted dreambreaker write
-- Signature, grants, RLS, RBAC unchanged.
-- Does not implement Stage Tie-break Policy.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_tournament_record_dreambreaker_point(
  p_tournament_id text, p_matchup_id text, p_scoring_team_id text,
  p_expected_version integer default null, p_idempotency_key text default null
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_header public.team_tournaments; v_matchup public.team_tournament_matchups;
  v_db public.team_tournament_dreambreaker_states; v_disc public.team_tournament_disciplines;
  v_updated public.team_tournament_dreambreaker_states;
  v_cmd json; v_hash text; v_result jsonb;
  v_a int; v_b int; v_hist jsonb; v_seg int; v_pts int; v_rot int; v_target int; v_win_by int;
  v_winner text := null; v_completed boolean := false;
  v_override jsonb; v_fmt jsonb;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED'); end if;
  if not public.team_tournament_can_manage_results() then return json_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);
  select * into v_matchup from public.team_tournament_matchups
  where team_tournament_id = v_header.id and external_matchup_id = p_matchup_id;
  if v_matchup.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  select * into v_db from public.team_tournament_dreambreaker_states where matchup_id = v_matchup.id;
  if v_db.id is null or v_db.status <> 'in_progress' then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Dreambreaker chưa bắt đầu.');
  end if;
  if p_scoring_team_id not in (v_matchup.team_a_id, v_matchup.team_b_id) then
    return json_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  -- DREAMBREAKER_POINT_EXPECTED_VERSION_REQUIRED
  -- CANONICAL_VERSION_AUTHORITY = dreambreaker_states.version
  -- NO_TOURNAMENT_VERSION_CAS
  -- NO_MATCHUP_VERSION_CAS
  if p_expected_version is null then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Thiếu dreambreaker.version.');
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'record_dreambreaker_point', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'scoringTeamId', p_scoring_team_id, 'expectedVersion', p_expected_version));
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  -- DREAMBREAKER_SCORING_RESOLVE_01
  -- CANONICAL_DREAMBREAKER_DEFAULT_TARGET = 21 (fallback only)
  v_override := coalesce(
    nullif(v_matchup.schedule_meta->'dreambreakerScoringFormat', 'null'::jsonb),
    nullif(v_matchup.schedule_meta->'dreambreaker'->'scoringFormat', 'null'::jsonb),
    '{}'::jsonb
  );

  select * into v_disc
  from (
    select d.*,
      case
        when lower(coalesce(d.discipline_kind, '')) = 'dreambreaker' then 1
        when lower(coalesce(d.activation_rule, '')) = 'tie_at_2_2' then 2
        when lower(coalesce(d.activation_rule, '')) = 'dreambreaker' then 3
        when lower(coalesce(d.name, '')) like '%dreambreaker%'
          or lower(coalesce(d.external_discipline_id, '')) like '%dreambreaker%'
          or lower(coalesce(d.discipline_kind, '')) like '%dreambreaker%' then 4
        else null
      end as match_rank
    from public.team_tournament_disciplines d
    where d.team_tournament_id = v_header.id
  ) ranked
  where match_rank is not null
  order by match_rank, sort_order nulls last
  limit 1;

  v_fmt := coalesce(v_disc.scoring_format, '{}'::jsonb);

  v_target := coalesce(
    case when (v_override->>'targetScore') ~ '^[1-9][0-9]*$' then (v_override->>'targetScore')::int end,
    case when (v_override->>'targetPoints') ~ '^[1-9][0-9]*$' then (v_override->>'targetPoints')::int end,
    case when (v_fmt->>'targetScore') ~ '^[1-9][0-9]*$' then (v_fmt->>'targetScore')::int end,
    case when (v_fmt->>'targetPoints') ~ '^[1-9][0-9]*$' then (v_fmt->>'targetPoints')::int end,
    21
  );
  v_win_by := coalesce(
    case when (v_override->>'winBy') ~ '^[1-9][0-9]*$' then (v_override->>'winBy')::int end,
    case when (v_fmt->>'winBy') ~ '^[1-9][0-9]*$' then (v_fmt->>'winBy')::int end,
    2
  );
  v_rot := coalesce(
    case when (v_override->>'rotationPoints') ~ '^[1-9][0-9]*$' then (v_override->>'rotationPoints')::int end,
    case when (v_fmt->>'rotationPoints') ~ '^[1-9][0-9]*$' then (v_fmt->>'rotationPoints')::int end,
    4
  );

  v_a := v_db.team_a_score + case when p_scoring_team_id = v_matchup.team_a_id then 1 else 0 end;
  v_b := v_db.team_b_score + case when p_scoring_team_id = v_matchup.team_b_id then 1 else 0 end;
  v_seg := coalesce((v_db.rotation->>'segmentIndex')::int, 0);
  v_pts := coalesce((v_db.rotation->>'pointsInSegment')::int, 0) + 1;
  v_hist := coalesce(v_db.rotation->'pointHistory', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('teamId', p_scoring_team_id, 'segmentIndex', v_seg, 'teamAScore', v_a, 'teamBScore', v_b)
  );
  if v_pts >= v_rot then v_seg := v_seg + 1; v_pts := 0; end if;

  if greatest(v_a, v_b) >= v_target and abs(v_a - v_b) >= v_win_by then
    v_winner := case when v_a > v_b then v_matchup.team_a_id else v_matchup.team_b_id end;
    v_completed := true;
  end if;

  -- DREAMBREAKER_POINT_CAS_ATOMIC
  -- STALE_POINT_ZERO_WRITE
  -- CONCURRENT_DUPLICATE_POINT_BLOCKED
  update public.team_tournament_dreambreaker_states set
    team_a_score = v_a, team_b_score = v_b, winner_team_id = v_winner,
    status = case when v_completed then 'completed' else 'in_progress' end,
    rotation = jsonb_build_object(
      'segmentIndex', v_seg, 'pointsInSegment', v_pts, 'pointHistory', v_hist,
      'injurySkips', coalesce(rotation->'injurySkips', '[]'::jsonb)
    ),
    version = version + 1, updated_at = now(), updated_by = auth.uid()
  where id = v_db.id
    and version = p_expected_version
  returning * into v_updated;

  if v_updated.id is null then
    select * into v_db from public.team_tournament_dreambreaker_states where matchup_id = v_matchup.id;
    return public.team_tournament_version_conflict(
      'team_tournament_dreambreaker_states', p_expected_version, v_db.version
    );
  end if;
  v_db := v_updated;

  if v_db.sub_match_external_id is not null then
    update public.team_tournament_sub_matches set
      score = jsonb_build_object('teamA', v_a, 'teamB', v_b, 'games', '[]'::jsonb),
      status = case when v_completed then 'completed' else 'playing' end,
      winner_team_id = v_winner,
      result_confirmed_at = case when v_completed then now() else result_confirmed_at end,
      version = version + 1, updated_at = now(), updated_by = auth.uid()
    where matchup_id = v_matchup.id and external_sub_match_id = v_db.sub_match_external_id;
  end if;

  if v_completed then
    perform public.team_tournament_recompute_matchup_result(v_matchup.id);
  end if;

  v_result := jsonb_build_object(
    'ok', true, 'version', v_db.version, 'teamAScore', v_a, 'teamBScore', v_b,
    'completed', v_completed, 'winnerTeamId', v_winner, 'status', v_db.status,
    'scoringFormat', jsonb_build_object(
      'targetScore', v_target, 'winBy', v_win_by, 'rotationPoints', v_rot
    )
  );
  perform public.team_tournament_write_audit(v_header.tenant_id, v_header.tournament_id,
    'team.match.dreambreaker.point', p_matchup_id, v_result);
  perform public.team_tournament_finish_command(v_header.tenant_id, p_tournament_id,
    'record_dreambreaker_point', p_idempotency_key, v_hash, v_result);
  return v_result;
end;
$$;
