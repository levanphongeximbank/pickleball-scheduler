-- team-tournament-post-lineup-complete-lifecycle-01 / 03_VERIFY
-- LOCAL ONLY. Functional proofs use disposable rows (inserted then deleted).
-- Does not leave Staging mutations after successful VERIFY.

-- Definition / contract checks
do $$
declare
  v_close text;
  v_cfg text;
  v_ready text;
  v_search text;
begin
  if to_regprocedure('public.team_tournament_close_tournament(text, jsonb, integer, text)') is null then
    raise exception 'VERIFY_FAIL: close tournament RPC missing';
  end if;
  if to_regprocedure('public.team_tournament_assert_close_readiness(uuid)') is null then
    raise exception 'VERIFY_FAIL: assert_close_readiness missing';
  end if;
  if to_regprocedure('public.team_tournament_search_referee_candidates(text, text, integer)') is null then
    raise exception 'VERIFY_FAIL: search_referee_candidates missing';
  end if;

  v_close := pg_get_functiondef('public.team_tournament_close_tournament(text, jsonb, integer, text)'::regprocedure);
  v_ready := pg_get_functiondef('public.team_tournament_assert_close_readiness(uuid)'::regprocedure);
  v_cfg := pg_get_functiondef('public.team_tournament_update_setup_config(text, jsonb, integer, text)'::regprocedure);
  v_search := pg_get_functiondef('public.team_tournament_search_referee_candidates(text, text, integer)'::regprocedure);

  if position('team_tournament_assert_close_readiness' in v_close) = 0 then
    raise exception 'VERIFY_FAIL: close must call assert_close_readiness';
  end if;
  if position('status = ''completed''' in v_close) = 0 then
    raise exception 'VERIFY_FAIL: close must set status completed';
  end if;
  if position('canonical_tournaments' in lower(v_close)) = 0 then
    raise exception 'VERIFY_FAIL: close must dual-write canonical_tournaments';
  end if;
  if position('awardsSheet' in v_close) > 0 and position('CLIENT_RESULT_PAYLOAD_TRUSTED' in v_close) = 0 then
    -- awardsSheet may appear only in discard comment path; must not merge client awards as authority
    if position('v_payload->''awardsSheet''' in v_close) > 0 then
      raise exception 'VERIFY_FAIL: close must not persist client awardsSheet as authority';
    end if;
  end if;
  if position('GROUP_STAGE_INCOMPLETE' in v_ready) = 0
     or position('ELIMINATION_INCOMPLETE' in v_ready) = 0
     or position('FINAL_NOT_COMPLETED' in v_ready) = 0
     or position('CHAMPION_UNRESOLVED' in v_ready) = 0 then
    raise exception 'VERIFY_FAIL: readiness must expose structured fail-closed codes';
  end if;
  if position('qualifiersPerGroup' in v_cfg) = 0 then
    raise exception 'VERIFY_FAIL: setup config must whitelist qualifiersPerGroup';
  end if;
  if position('stageScoringPolicy' in v_cfg) = 0 then
    raise exception 'VERIFY_FAIL: setup config must whitelist stageScoringPolicy';
  end if;
  if position('targetPoints' in v_cfg) = 0 or position('winBy' in v_cfg) = 0 then
    raise exception 'VERIFY_FAIL: stage scoring must validate canonical fields';
  end if;
  if position('p.role' in lower(v_search)) > 0 then
    raise exception 'VERIFY_FAIL: referee candidate search must not filter profiles.role';
  end if;
  if position('matchup.stage = ''quarterfinal''' in lower(v_cfg)) > 0 then
    raise exception 'VERIFY_FAIL: must not invent matchup.stage=quarterfinal taxonomy';
  end if;

  raise notice 'VERIFY_PASS: definition contracts';
end $$;

-- Functional disposable close-readiness matrix
do $$
declare
  v_tt uuid := gen_random_uuid();
  v_tid text := 'verify-lifecycle-close-' || substr(replace(v_tt::text, '-', ''), 1, 12);
  v_tenant text := 'verify-tenant-lifecycle-01';
  v_club text := 'verify-club-lifecycle-01';
  v_ready jsonb;
  v_mu_g1 uuid;
  v_mu_g2 uuid;
  v_mu_f uuid;
begin
  insert into public.team_tournaments (
    id, tenant_id, club_id, tournament_id, status, settings, version
  ) values (
    v_tt, v_tenant, v_club, v_tid, 'draft',
    jsonb_build_object('groupCount', 1, 'qualifiersPerGroup', 2),
    1
  );

  insert into public.team_tournament_teams (
    tenant_id, tournament_id, team_tournament_id, external_team_id, name
  ) values
    (v_tenant, v_tid, v_tt, 'team-a', 'Team A'),
    (v_tenant, v_tid, v_tt, 'team-b', 'Team B');

  -- 1) incomplete one-group → DENIED
  insert into public.team_tournament_matchups (
    tenant_id, tournament_id, team_tournament_id, external_matchup_id,
    team_a_id, team_b_id, status, result, schedule_meta, version
  ) values (
    v_tenant, v_tid, v_tt, 'g1',
    'team-a', 'team-b', 'lineup_open', '{}'::jsonb,
    jsonb_build_object('stage', 'group'), 1
  ) returning id into v_mu_g1;

  v_ready := public.team_tournament_assert_close_readiness(v_tt);
  if coalesce((v_ready->>'ok')::boolean, false) or v_ready->>'code' is distinct from 'GROUP_STAGE_INCOMPLETE' then
    raise exception 'VERIFY_FAIL: one-group incomplete expected GROUP_STAGE_INCOMPLETE got %', v_ready;
  end if;

  -- 2) completed one-group RR → eligible
  update public.team_tournament_matchups
     set status = 'completed',
         result = jsonb_build_object('winnerTeamId', 'team-a', 'teamAWins', 3, 'teamBWins', 1, 'teamAPoints', 33, 'teamBPoints', 21)
   where id = v_mu_g1;

  v_ready := public.team_tournament_assert_close_readiness(v_tt);
  if not coalesce((v_ready->>'ok')::boolean, false) then
    raise exception 'VERIFY_FAIL: one-group complete should be eligible got %', v_ready;
  end if;
  if v_ready->>'championTeamId' is distinct from 'team-a' then
    raise exception 'VERIFY_FAIL: one-group champion expected team-a got %', v_ready->>'championTeamId';
  end if;

  -- 3) incomplete multi-group elimination → DENIED
  update public.team_tournaments
     set settings = jsonb_build_object('groupCount', 2, 'qualifiersPerGroup', 1)
   where id = v_tt;

  insert into public.team_tournament_matchups (
    tenant_id, tournament_id, team_tournament_id, external_matchup_id,
    team_a_id, team_b_id, status, result, schedule_meta, version
  ) values (
    v_tenant, v_tid, v_tt, 'g2',
    'team-a', 'team-b', 'completed',
    jsonb_build_object('winnerTeamId', 'team-b', 'teamAWins', 1, 'teamBWins', 3, 'teamAPoints', 21, 'teamBPoints', 33),
    jsonb_build_object('stage', 'group'), 1
  ) returning id into v_mu_g2;

  insert into public.team_tournament_matchups (
    tenant_id, tournament_id, team_tournament_id, external_matchup_id,
    team_a_id, team_b_id, status, result, schedule_meta, version
  ) values (
    v_tenant, v_tid, v_tt, 'final-1',
    'team-a', 'team-b', 'scheduled', '{}'::jsonb,
    jsonb_build_object('stage', 'knockout', 'competitionStage', 'final'), 1
  ) returning id into v_mu_f;

  v_ready := public.team_tournament_assert_close_readiness(v_tt);
  if coalesce((v_ready->>'ok')::boolean, false)
     or v_ready->>'code' not in ('ELIMINATION_INCOMPLETE', 'FINAL_NOT_COMPLETED') then
    raise exception 'VERIFY_FAIL: multi-group incomplete expected elimination/final deny got %', v_ready;
  end if;

  -- 4) final completed + champion resolved → eligible
  update public.team_tournament_matchups
     set status = 'completed',
         result = jsonb_build_object('winnerTeamId', 'team-b', 'teamAWins', 1, 'teamBWins', 3, 'teamAPoints', 21, 'teamBPoints', 33)
   where id = v_mu_f;

  v_ready := public.team_tournament_assert_close_readiness(v_tt);
  if not coalesce((v_ready->>'ok')::boolean, false) then
    raise exception 'VERIFY_FAIL: final complete should be eligible got %', v_ready;
  end if;
  if v_ready->>'championTeamId' is distinct from 'team-b' then
    raise exception 'VERIFY_FAIL: multi-group champion expected team-b got %', v_ready->>'championTeamId';
  end if;

  -- 5) client cannot forge champion via readiness (server derives from matchups only)
  if v_ready ? 'clientChampion' then
    raise exception 'VERIFY_FAIL: readiness must not accept client champion fields';
  end if;

  -- cleanup disposable
  delete from public.team_tournament_matchups where team_tournament_id = v_tt;
  delete from public.team_tournament_teams where team_tournament_id = v_tt;
  delete from public.team_tournaments where id = v_tt;

  raise notice 'VERIFY_PASS: disposable close-readiness matrix';
exception when others then
  delete from public.team_tournament_matchups where team_tournament_id = v_tt;
  delete from public.team_tournament_teams where team_tournament_id = v_tt;
  delete from public.team_tournaments where id = v_tt;
  raise;
end $$;

select
  'grants' as check_name,
  has_function_privilege('authenticated', 'public.team_tournament_close_tournament(text, jsonb, integer, text)', 'execute') as close_exec,
  has_function_privilege('authenticated', 'public.team_tournament_assert_close_readiness(uuid)', 'execute') as ready_exec,
  has_function_privilege('authenticated', 'public.team_tournament_search_referee_candidates(text, text, integer)', 'execute') as search_exec,
  has_function_privilege('authenticated', 'public.team_tournament_update_setup_config(text, jsonb, integer, text)', 'execute') as setup_exec;
