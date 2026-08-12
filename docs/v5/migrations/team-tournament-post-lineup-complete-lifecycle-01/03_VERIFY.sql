-- team-tournament-post-lineup-complete-lifecycle-01 / 03_VERIFY
-- LOCAL ONLY.

do $$
declare
  v_close text;
  v_cfg text;
begin
  if to_regprocedure('public.team_tournament_close_tournament(text, jsonb, integer, text)') is null then
    raise exception 'VERIFY_FAIL: close tournament RPC missing';
  end if;

  v_close := pg_get_functiondef('public.team_tournament_close_tournament(text, jsonb, integer, text)'::regprocedure);
  if position('status = ''completed''' in v_close) = 0 then
    raise exception 'VERIFY_FAIL: close must set status completed';
  end if;
  if position('canonical_tournaments' in lower(v_close)) = 0 then
    raise exception 'VERIFY_FAIL: close must dual-write canonical_tournaments';
  end if;
  if position('team_tournaments' in lower(v_close)) = 0 then
    raise exception 'VERIFY_FAIL: close must update team_tournaments';
  end if;

  v_cfg := pg_get_functiondef('public.team_tournament_update_setup_config(text, jsonb, integer, text)'::regprocedure);
  if position('qualifiersPerGroup' in v_cfg) = 0 then
    raise exception 'VERIFY_FAIL: setup config must whitelist qualifiersPerGroup';
  end if;
  if position('stageScoringPolicy' in v_cfg) = 0 then
    raise exception 'VERIFY_FAIL: setup config must whitelist stageScoringPolicy';
  end if;
  if position('INVALID_QUALIFICATION_TOTAL' in v_cfg) = 0 then
    raise exception 'VERIFY_FAIL: setup config must fail-closed non PoT totals';
  end if;
  -- Coarse stage taxonomy must remain group|knockout (no second stage SSOT in this package).
  if position('matchup.stage = ''quarterfinal''' in lower(v_cfg)) > 0 then
    raise exception 'VERIFY_FAIL: must not invent matchup.stage=quarterfinal taxonomy';
  end if;

  raise notice 'VERIFY_PASS: team-tournament-post-lineup-complete-lifecycle-01';
end $$;

select
  'grants' as check_name,
  has_function_privilege('authenticated', 'public.team_tournament_close_tournament(text, jsonb, integer, text)', 'execute') as close_exec,
  has_function_privilege('authenticated', 'public.team_tournament_update_setup_config(text, jsonb, integer, text)', 'execute') as setup_exec;
