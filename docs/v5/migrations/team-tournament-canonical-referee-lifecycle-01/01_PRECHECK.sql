-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-canonical-referee-lifecycle-01
-- LOCAL ONLY. Do NOT apply on Staging/Production without Owner GO.
-- Read-only. OWNER_FIXTURE_MUTATIONS=0. PRODUCTION_MUTATIONS=0.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_missing text[] := '{}';
begin
  if to_regclass('public.referee_assignments') is null then
    v_missing := v_missing || 'referee_assignments';
  end if;
  if to_regclass('public.team_sub_match_referee_links') is null then
    v_missing := v_missing || 'team_sub_match_referee_links';
  end if;
  if to_regclass('public.match_live_states') is null then
    v_missing := v_missing || 'match_live_states';
  end if;
  if to_regclass('public.team_tournament_dreambreaker_states') is null then
    v_missing := v_missing || 'team_tournament_dreambreaker_states';
  end if;
  if to_regprocedure('public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)') is null then
    v_missing := v_missing || 'create_referee_assignment';
  end if;
  if to_regprocedure('public.team_tournament_start_dreambreaker(text,text,integer,text)') is null then
    v_missing := v_missing || 'start_dreambreaker';
  end if;
  if to_regprocedure('public.team_tournament_confirm_sub_match(text,text,text,jsonb,text,integer,text)') is null then
    v_missing := v_missing || 'confirm_sub_match';
  end if;
  if to_regprocedure('public.team_tournament_provision_eligibility(team_tournaments,team_tournament_matchups,team_tournament_sub_matches,uuid)') is null then
    v_missing := v_missing || 'provision_eligibility';
  end if;
  if to_regprocedure('public.team_tournament_can_manage_results()') is null then
    v_missing := v_missing || 'can_manage_results';
  end if;
  if to_regprocedure('public.team_tournament_can_manage()') is null then
    v_missing := v_missing || 'can_manage';
  end if;
  if to_regprocedure('public.team_tournament_build_v5_state_shell(text,text,text,text[],text[],text,jsonb)') is null then
    v_missing := v_missing || 'build_v5_state_shell';
  end if;
  if array_length(v_missing, 1) is not null then
    raise exception 'PRECHECK_FAIL missing=%', array_to_string(v_missing, ',');
  end if;

  raise notice 'PRECHECK_PASS canonical referee lifecycle prerequisites present';
end;
$$;

-- Owner E2E fixture must remain read-only after APPLY (VERIFY asserts mutation count).
select
  'owner_fixture_present' as check_name,
  exists (
    select 1 from public.team_tournaments
    where id = '89d8ffed-70f1-4bd1-9294-abdf0016bbad'
       or tournament_id = '89d8ffed-70f1-4bd1-9294-abdf0016bbad'
  ) as ok;
