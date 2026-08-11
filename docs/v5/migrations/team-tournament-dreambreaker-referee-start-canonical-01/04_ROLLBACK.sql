-- ═══════════════════════════════════════════════════════════════════
-- 04_ROLLBACK.sql
-- Package: team-tournament-dreambreaker-referee-start-canonical-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-REFEREE-START-CANONICAL-REMEDIATION-01
-- Restores the exact prior start RPC body from
-- team-tournament-dreambreaker-advancement-canonical-remediation-01.
-- DO NOT APPLY without Owner GO.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_tournament_start_dreambreaker(
  p_tournament_id text, p_matchup_id text,
  p_expected_version integer default null, p_idempotency_key text default null
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_header public.team_tournaments; v_matchup public.team_tournament_matchups;
  v_db public.team_tournament_dreambreaker_states; v_disc public.team_tournament_disciplines;
  v_cmd json; v_hash text; v_result jsonb; v_sub_ext text; v_sub_id uuid;
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
  if v_db.id is null then return json_build_object('ok', false, 'code', 'NOT_ACTIVATED'); end if;
  if jsonb_array_length(coalesce(v_db.team_a_order,'[]'::jsonb)) <> 4
     or jsonb_array_length(coalesce(v_db.team_b_order,'[]'::jsonb)) <> 4 then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Hai đội phải có thứ tự 4 VĐV.');
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'start_dreambreaker', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'expectedVersion', p_expected_version));
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';
  if p_expected_version is not null and v_db.version <> p_expected_version then
    return public.team_tournament_version_conflict('team_tournament_dreambreaker_states', p_expected_version, v_db.version);
  end if;

  select * into v_disc from public.team_tournament_disciplines d
  where d.team_tournament_id = v_header.id
    and (lower(coalesce(d.name,'')) like '%dreambreaker%'
      or lower(coalesce(d.external_discipline_id,'')) like '%dreambreaker%'
      or lower(coalesce(d.discipline_kind,'')) like '%dreambreaker%'
      or lower(coalesce(d.activation_rule,'')) = 'dreambreaker')
  order by d.sort_order nulls last limit 1;
  if v_disc.id is null then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Thiếu nội dung Dreambreaker.');
  end if;

  v_sub_ext := coalesce(nullif(trim(v_db.sub_match_external_id), ''), 'db-' || p_matchup_id);
  select id into v_sub_id from public.team_tournament_sub_matches
  where matchup_id = v_matchup.id and external_sub_match_id = v_sub_ext;
  if v_sub_id is null then
    insert into public.team_tournament_sub_matches (
      tenant_id, tournament_id, matchup_id, discipline_external_id, external_sub_match_id,
      sort_order, status, score, winner_team_id, version, updated_by
    ) values (
      v_header.tenant_id, v_header.tournament_id, v_matchup.id, v_disc.external_discipline_id, v_sub_ext,
      coalesce(v_disc.sort_order, 99), 'playing',
      jsonb_build_object('teamA', 0, 'teamB', 0, 'games', '[]'::jsonb),
      null, 1, auth.uid()
    ) returning id into v_sub_id;
  end if;

  update public.team_tournament_dreambreaker_states set
    status = 'in_progress', sub_match_external_id = v_sub_ext,
    team_a_score = 0, team_b_score = 0, winner_team_id = null,
    rotation = jsonb_build_object(
      'segmentIndex', 0, 'pointsInSegment', 0, 'pointHistory', '[]'::jsonb,
      'injurySkips', coalesce(rotation->'injurySkips', '[]'::jsonb)
    ),
    orders_locked_at = coalesce(orders_locked_at, now()),
    version = version + 1, updated_at = now(), updated_by = auth.uid()
  where id = v_db.id returning * into v_db;

  update public.team_tournament_matchups set status = 'in_progress', updated_at = now(), updated_by = auth.uid()
  where id = v_matchup.id;

  v_result := jsonb_build_object('ok', true, 'version', v_db.version, 'status', v_db.status,
    'subMatchId', v_sub_ext);
  perform public.team_tournament_write_audit(v_header.tenant_id, v_header.tournament_id,
    'team.match.dreambreaker.start', p_matchup_id, v_result);
  perform public.team_tournament_finish_command(v_header.tenant_id, p_tournament_id,
    'start_dreambreaker', p_idempotency_key, v_hash, v_result);
  return v_result;
end;
$$;
