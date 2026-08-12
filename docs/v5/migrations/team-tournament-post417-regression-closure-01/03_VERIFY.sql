-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-post417-regression-closure-01
-- LOCAL PACKAGE ONLY. Does not mutate domain rows.
--
-- Architecture under test:
--   team_tournament_create CALLS team_tournament_seed_mlp_disciplines
--   and returns teamData. MLP catalog literals live in the seed helper.
-- Do not require mlp-wd / Đôi nam / dreambreaker inside create().
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_create text;
  v_seed text;
  v_commit text;
begin
  if to_regprocedure('public.team_tournament_create(text,text,text,text,text,text,jsonb)') is null then
    raise exception 'VERIFY_FAIL: team_tournament_create missing';
  end if;
  if to_regprocedure('public.team_tournament_seed_mlp_disciplines(public.team_tournaments)') is null then
    raise exception 'VERIFY_FAIL: team_tournament_seed_mlp_disciplines missing';
  end if;
  if to_regprocedure('public.team_tournament_initial_setup_team_data(public.team_tournaments)') is null then
    raise exception 'VERIFY_FAIL: team_tournament_initial_setup_team_data missing';
  end if;
  if to_regprocedure('public.team_tournament_commit_pairing(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception 'VERIFY_FAIL: team_tournament_commit_pairing missing';
  end if;

  select pg_get_functiondef('public.team_tournament_create(text,text,text,text,text,text,jsonb)'::regprocedure)
    into v_create;
  select pg_get_functiondef('public.team_tournament_seed_mlp_disciplines(public.team_tournaments)'::regprocedure)
    into v_seed;
  select pg_get_functiondef('public.team_tournament_commit_pairing(text,jsonb,jsonb,jsonb,integer)'::regprocedure)
    into v_commit;

  if position('team_tournament_seed_mlp_disciplines' in v_create) = 0 then
    raise exception 'VERIFY_FAIL: create does not call MLP seed helper';
  end if;
  if position('teamData' in v_create) = 0 then
    raise exception 'VERIFY_FAIL: create does not return teamData';
  end if;

  if position('mlp-wd' in v_seed) = 0 then
    raise exception 'VERIFY_FAIL: seed helper missing mlp-wd';
  end if;
  if position('mlp-md' in v_seed) = 0 then
    raise exception 'VERIFY_FAIL: seed helper missing mlp-md';
  end if;
  if position('mlp-xd1' in v_seed) = 0 then
    raise exception 'VERIFY_FAIL: seed helper missing mlp-xd1';
  end if;
  if position('mlp-xd2' in v_seed) = 0 then
    raise exception 'VERIFY_FAIL: seed helper missing mlp-xd2';
  end if;
  if position('dreambreaker' in v_seed) = 0 then
    raise exception 'VERIFY_FAIL: seed helper missing dreambreaker catalog';
  end if;
  if position('Đôi nam' in v_seed) = 0 then
    raise exception 'VERIFY_FAIL: seed helper missing Đôi nam';
  end if;
  if position('Đôi nữ' in v_seed) = 0 then
    raise exception 'VERIFY_FAIL: seed helper missing Đôi nữ';
  end if;
  if position('Đôi nam nữ 1' in v_seed) = 0 then
    raise exception 'VERIFY_FAIL: seed helper missing Đôi nam nữ 1';
  end if;
  if position('Đôi nam nữ 2' in v_seed) = 0 then
    raise exception 'VERIFY_FAIL: seed helper missing Đôi nam nữ 2';
  end if;
  if position('discipline_kind' in v_seed) = 0 then
    raise exception 'VERIFY_FAIL: seed helper missing discipline_kind';
  end if;
  if position('tie_at_2_2' in v_seed) = 0 then
    raise exception 'VERIFY_FAIL: seed helper missing Dreambreaker activationRule tie_at_2_2';
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
