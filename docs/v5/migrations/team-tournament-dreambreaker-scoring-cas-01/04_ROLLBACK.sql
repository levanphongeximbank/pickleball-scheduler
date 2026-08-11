-- ═══════════════════════════════════════════════════════════════════
-- 04_ROLLBACK.sql
-- Package: team-tournament-dreambreaker-scoring-cas-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-SCORING-CONFIG-CAS-01
-- Restores the exact prior record-point RPC body from Staging
-- (hidden default target=11, optional CAS).
-- DO NOT APPLY without Owner GO.
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
  v_cmd json; v_hash text; v_result jsonb;
  v_a int; v_b int; v_hist jsonb; v_seg int; v_pts int; v_rot int; v_target int; v_win_by int;
  v_winner text := null; v_completed boolean := false;
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

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'record_dreambreaker_point', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'scoringTeamId', p_scoring_team_id, 'expectedVersion', p_expected_version));
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';
  if p_expected_version is not null and v_db.version <> p_expected_version then
    return public.team_tournament_version_conflict('team_tournament_dreambreaker_states', p_expected_version, v_db.version);
  end if;

  select * into v_disc from public.team_tournament_disciplines d
  where d.team_tournament_id = v_header.id
    and (lower(coalesce(d.name,'')) like '%dreambreaker%' or lower(coalesce(d.discipline_kind,'')) like '%dreambreaker%')
  limit 1;
  v_rot := coalesce((v_disc.scoring_format->>'rotationPoints')::int, 4);
  v_target := coalesce((v_disc.scoring_format->>'targetScore')::int, 11);
  v_win_by := coalesce((v_disc.scoring_format->>'winBy')::int, 2);

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

  update public.team_tournament_dreambreaker_states set
    team_a_score = v_a, team_b_score = v_b, winner_team_id = v_winner,
    status = case when v_completed then 'completed' else 'in_progress' end,
    rotation = jsonb_build_object(
      'segmentIndex', v_seg, 'pointsInSegment', v_pts, 'pointHistory', v_hist,
      'injurySkips', coalesce(rotation->'injurySkips', '[]'::jsonb)
    ),
    version = version + 1, updated_at = now(), updated_by = auth.uid()
  where id = v_db.id returning * into v_db;

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

  v_result := jsonb_build_object('ok', true, 'version', v_db.version, 'teamAScore', v_a, 'teamBScore', v_b,
    'completed', v_completed, 'winnerTeamId', v_winner, 'status', v_db.status);
  perform public.team_tournament_write_audit(v_header.tenant_id, v_header.tournament_id,
    'team.match.dreambreaker.point', p_matchup_id, v_result);
  perform public.team_tournament_finish_command(v_header.tenant_id, p_tournament_id,
    'record_dreambreaker_point', p_idempotency_key, v_hash, v_result);
  return v_result;
end;
$$;
