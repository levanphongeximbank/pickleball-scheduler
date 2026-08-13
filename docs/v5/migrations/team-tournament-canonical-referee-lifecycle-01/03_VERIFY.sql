-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-canonical-referee-lifecycle-01
-- Read-only. OWNER_FIXTURE_MUTATIONS=0.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_start text;
  v_create text;
  v_elig text;
  v_confirm text;
  v_list text;
  v_fail text[] := '{}';
begin
  if to_regprocedure('public.team_tournament_resolve_effective_referee_assignment(team_tournaments,team_tournament_matchups,team_tournament_sub_matches)') is null then
    v_fail := v_fail || 'missing_resolve_effective';
  end if;
  if to_regprocedure('public.team_tournament_result_write_guard(team_tournaments,team_tournament_matchups,team_tournament_sub_matches)') is null then
    v_fail := v_fail || 'missing_result_write_guard';
  end if;
  if to_regprocedure('public.team_tournament_ensure_referee_runtime_for_matchup(team_tournaments,team_tournament_matchups,text)') is null then
    v_fail := v_fail || 'missing_ensure_runtime';
  end if;

  v_start := pg_get_functiondef('public.team_tournament_start_dreambreaker(text,text,integer,text)'::regprocedure);
  if position('team_tournament_result_write_guard' in v_start) = 0 then
    v_fail := v_fail || 'start_missing_scoped_guard';
  end if;
  if position('ALREADY_STARTED' in v_start) = 0 then
    v_fail := v_fail || 'start_missing_already_started';
  end if;
  if position('can_manage_results()' in v_start) > 0 then
    v_fail := v_fail || 'start_still_broad_can_manage_results';
  end if;

  v_create := pg_get_functiondef('public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)'::regprocedure);
  if position('v_parent' in v_create) = 0 then
    v_fail := v_fail || 'create_missing_parent_scope';
  end if;
  if position('ensure_referee_runtime_for_matchup' in v_create) = 0 then
    v_fail := v_fail || 'create_missing_auto_ensure';
  end if;

  v_elig := pg_get_functiondef('public.team_tournament_provision_eligibility(team_tournaments,team_tournament_matchups,team_tournament_sub_matches,uuid)'::regprocedure);
  if position('dreambreaker_out_of_scope' in v_elig) > 0 then
    v_fail := v_fail || 'eligibility_still_blocks_dreambreaker';
  end if;
  if position('v_parent_ok' in v_elig) = 0 then
    v_fail := v_fail || 'eligibility_missing_parent_match';
  end if;

  v_confirm := pg_get_functiondef('public.team_tournament_confirm_sub_match(text,text,text,jsonb,text,integer,text)'::regprocedure);
  if position('team_tournament_result_write_guard' in v_confirm) = 0 then
    v_fail := v_fail || 'confirm_missing_scoped_guard';
  end if;
  if position('can_manage_results()' in v_confirm) > 0 then
    v_fail := v_fail || 'confirm_still_broad_can_manage_results';
  end if;

  v_list := pg_get_functiondef('public.team_tournament_list_my_referee_assignments(text)'::regprocedure);
  if position('''parent''' in v_list) = 0 then
    v_fail := v_fail || 'list_my_missing_parent_scope';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_tt_matchup_ensure_referee_runtime'
  ) then
    v_fail := v_fail || 'missing_matchup_ensure_trigger';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_tt_sub_match_ensure_referee_runtime'
  ) then
    v_fail := v_fail || 'missing_sub_match_ensure_trigger';
  end if;

  if array_length(v_fail, 1) is not null then
    raise exception 'VERIFY_FAIL %', array_to_string(v_fail, ',');
  end if;
  raise notice 'VERIFY_PASS canonical referee lifecycle';
end;
$$;

-- Owner E2E must remain untouched (read-only assertion).
select
  t.id,
  t.status,
  t.updated_at
from public.team_tournaments t
where t.id = '89d8ffed-70f1-4bd1-9294-abdf0016bbad'
   or t.tournament_id = '89d8ffed-70f1-4bd1-9294-abdf0016bbad';
