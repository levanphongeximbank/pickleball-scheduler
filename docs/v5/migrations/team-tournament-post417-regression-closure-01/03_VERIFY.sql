-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-post417-regression-closure-01
-- LOCAL PACKAGE ONLY. Does not mutate domain rows.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_create text;
  v_commit text;
begin
  if to_regprocedure('public.team_tournament_create(text,text,text,text,text,text,jsonb)') is null then
    raise exception 'VERIFY_FAIL: team_tournament_create missing';
  end if;
  if to_regprocedure('public.team_tournament_commit_pairing(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception 'VERIFY_FAIL: team_tournament_commit_pairing missing';
  end if;
  if to_regprocedure('public.team_tournament_seed_mlp_disciplines(public.team_tournaments)') is null then
    raise exception 'VERIFY_FAIL: team_tournament_seed_mlp_disciplines missing';
  end if;
  if to_regprocedure('public.team_tournament_initial_setup_team_data(public.team_tournaments)') is null then
    raise exception 'VERIFY_FAIL: team_tournament_initial_setup_team_data missing';
  end if;

  select pg_get_functiondef('public.team_tournament_create(text,text,text,text,text,text,jsonb)'::regprocedure)
    into v_create;
  select pg_get_functiondef('public.team_tournament_commit_pairing(text,jsonb,jsonb,jsonb,integer)'::regprocedure)
    into v_commit;

  if position('mlp-wd' in v_create) = 0 then
    raise exception 'VERIFY_FAIL: create does not seed mlp-wd';
  end if;
  if position('Đôi nam' in v_create) = 0 then
    raise exception 'VERIFY_FAIL: create does not seed Đôi nam';
  end if;
  if position('Đôi nữ' in v_create) = 0 then
    raise exception 'VERIFY_FAIL: create does not seed Đôi nữ';
  end if;
  if position('dreambreaker' in v_create) = 0 then
    raise exception 'VERIFY_FAIL: create does not seed dreambreaker catalog';
  end if;
  if position('teamData' in v_create) = 0 then
    raise exception 'VERIFY_FAIL: create does not return teamData';
  end if;
  if position('team_tournament_seed_mlp_disciplines' in v_create) = 0 then
    raise exception 'VERIFY_FAIL: create does not call MLP seed helper';
  end if;
  if position('captain_player_id' in v_commit) = 0 then
    raise exception 'VERIFY_FAIL: commit_pairing missing captain persist';
  end if;
  if position('team_tournament_groups' in v_commit) = 0 then
    raise exception 'VERIFY_FAIL: commit_pairing missing groups persist';
  end if;
  if position('P0001' in v_commit) = 0 then
    raise exception 'VERIFY_FAIL: commit_pairing missing post-DML rollback raise';
  end if;
  if position('p_expected_version' in v_commit) = 0 then
    raise exception 'VERIFY_FAIL: commit_pairing missing CAS expected version';
  end if;
end;
$$;
