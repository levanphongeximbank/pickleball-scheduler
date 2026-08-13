-- team-tournament-owner-browser-acceptance-remediation-01 / 03_VERIFY
-- LOCAL ONLY. Functional proofs use disposable rows (inserted then deleted).
-- Corrected after lifecycle-01 VERIFY: real tenant from venues, required name,
-- club from existing team_tournaments (or clubs fallback). Cleanup → zero rows.

-- Definition / contract checks
do $$
declare
  v_cfg text;
  v_dir text;
begin
  if to_regprocedure('public.team_tournament_update_setup_config(text, jsonb, integer, text)') is null then
    raise exception 'VERIFY_FAIL: update_setup_config missing';
  end if;
  if to_regprocedure('public.team_tournament_referee_competition_athlete_directory(text)') is null then
    raise exception 'VERIFY_FAIL: referee_competition_athlete_directory missing';
  end if;
  if to_regprocedure('public.team_tournament_assert_close_readiness(uuid)') is null then
    raise exception 'VERIFY_FAIL: assert_close_readiness missing';
  end if;

  v_cfg := pg_get_functiondef('public.team_tournament_update_setup_config(text, jsonb, integer, text)'::regprocedure);
  v_dir := pg_get_functiondef('public.team_tournament_referee_competition_athlete_directory(text)'::regprocedure);

  if position('scoringMode' in v_cfg) = 0 then
    raise exception 'VERIFY_FAIL: setup config must whitelist/normalize scoringMode';
  end if;
  if position('scoringSystem' in v_cfg) = 0 then
    raise exception 'VERIFY_FAIL: setup config must accept scoringSystem alias';
  end if;
  if position('''traditional'', ''side_out'', ''sideout''' in v_cfg) = 0
     and position('side_out' in v_cfg) = 0 then
    raise exception 'VERIFY_FAIL: scoringMode must normalize traditional aliases';
  end if;
  if position('team_tournament_team_members' in v_dir) = 0 then
    raise exception 'VERIFY_FAIL: directory must read team_tournament_team_members';
  end if;
  if position('athletes' in lower(v_dir)) = 0 then
    raise exception 'VERIFY_FAIL: directory must join athletes';
  end if;
  if position('a.user_id' in v_dir) = 0 and position('p.id = a.user_id' in v_dir) = 0 then
    raise exception 'VERIFY_FAIL: directory must join profiles via athletes.user_id';
  end if;
  if position('club_list_members' in lower(v_dir)) > 0 then
    raise exception 'VERIFY_FAIL: directory must not call club_list_members';
  end if;
  if position('profiles.player_id' in lower(v_dir)) > 0
     or position('p.player_id' in lower(v_dir)) > 0 then
    raise exception 'VERIFY_FAIL: directory must not use profiles.player_id';
  end if;
  if position('referee_assignments' in v_dir) = 0 then
    raise exception 'VERIFY_FAIL: directory must allow assigned referees';
  end if;
  if position('revoked_at' in v_dir) = 0 then
    raise exception 'VERIFY_FAIL: directory referee allow must require revoked_at null';
  end if;

  raise notice 'VERIFY_PASS: definition contracts (scoringMode + directory)';
end $$;

-- Functional disposable close-readiness matrix (corrected tenant/name)
do $$
declare
  v_tt uuid := gen_random_uuid();
  v_tid text := 'verify-owner-accept-' || substr(replace(v_tt::text, '-', ''), 1, 12);
  v_tenant text;
  v_club text;
  v_ready jsonb;
  v_mu_g1 uuid;
  v_mu_g2 uuid;
  v_mu_f uuid;
  v_left int;
begin
  select v.id
    into v_tenant
  from public.venues v
  where v.id = 'venue-staging-a'
  limit 1;

  if v_tenant is null then
    select v.id into v_tenant from public.venues v order by v.id limit 1;
  end if;

  if v_tenant is null then
    raise exception 'VERIFY_FAIL: no venues row available for real tenant';
  end if;

  select tt.club_id
    into v_club
  from public.team_tournaments tt
  where tt.tenant_id = v_tenant
    and nullif(trim(coalesce(tt.club_id, '')), '') is not null
  order by tt.updated_at desc nulls last, tt.created_at desc nulls last
  limit 1;

  if v_club is null and to_regclass('public.clubs') is not null then
    select c.id
      into v_club
    from public.clubs c
    where c.tenant_id = v_tenant
      and c.deleted_at is null
    order by c.id
    limit 1;
  end if;

  if v_club is null then
    raise exception 'VERIFY_FAIL: no club_id available for tenant %', v_tenant;
  end if;

  -- REQUIRED name column on team_tournaments insert
  insert into public.team_tournaments (
    id, tenant_id, club_id, tournament_id, name, status, settings, version
  ) values (
    v_tt, v_tenant, v_club, v_tid,
    'VERIFY owner-browser-acceptance-01',
    'draft',
    jsonb_build_object('groupCount', 1, 'qualifiersPerGroup', 2),
    1
  );

  insert into public.team_tournament_teams (
    tenant_id, tournament_id, team_tournament_id, external_team_id, name
  ) values
    (v_tenant, v_tid, v_tt, 'team-a', 'Team A'),
    (v_tenant, v_tid, v_tt, 'team-b', 'Team B');

  -- 1) one-group incomplete → DENY
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

  -- 2) one-group complete → PASS
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

  -- 3) multi-group incomplete → DENY
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

  -- 4) final complete → PASS
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

  -- cleanup disposable
  delete from public.team_tournament_matchups where team_tournament_id = v_tt;
  delete from public.team_tournament_teams where team_tournament_id = v_tt;
  delete from public.team_tournaments where id = v_tt;

  select (
    (select count(*) from public.team_tournament_matchups where team_tournament_id = v_tt)
    + (select count(*) from public.team_tournament_teams where team_tournament_id = v_tt)
    + (select count(*) from public.team_tournaments where id = v_tt)
  )::int into v_left;

  if v_left <> 0 then
    raise exception 'VERIFY_FAIL: disposable cleanup left % residual rows', v_left;
  end if;

  raise notice 'VERIFY_PASS: disposable close-readiness matrix (tenant=%, club=%)', v_tenant, v_club;
exception when others then
  delete from public.team_tournament_matchups where team_tournament_id = v_tt;
  delete from public.team_tournament_teams where team_tournament_id = v_tt;
  delete from public.team_tournaments where id = v_tt;
  raise;
end $$;

select
  'grants' as check_name,
  has_function_privilege('authenticated', 'public.team_tournament_update_setup_config(text, jsonb, integer, text)', 'execute') as setup_exec,
  has_function_privilege('authenticated', 'public.team_tournament_referee_competition_athlete_directory(text)', 'execute') as directory_exec,
  has_function_privilege('authenticated', 'public.team_tournament_assert_close_readiness(uuid)', 'execute') as ready_exec,
  not has_function_privilege('anon', 'public.team_tournament_referee_competition_athlete_directory(text)', 'execute') as directory_anon_denied;
