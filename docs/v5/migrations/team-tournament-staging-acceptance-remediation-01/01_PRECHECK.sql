-- team-tournament-staging-acceptance-remediation-01 / 01_PRECHECK
-- LOCAL PACKAGE ONLY. Do not apply without Owner GO.
-- STAGING_MUTATIONS=0. PRODUCTION_MUTATIONS=0.

do $$
declare
  v_missing text[] := '{}';
begin
  if to_regclass('public.canonical_tournaments') is null then
    v_missing := array_append(v_missing, 'canonical_tournaments');
  end if;
  if to_regclass('public.team_tournaments') is null then
    v_missing := array_append(v_missing, 'team_tournaments');
  end if;
  if to_regprocedure('public.team_tournament_resolve_header(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_resolve_header');
  end if;
  if to_regprocedure('public.team_tournament_can_manage()') is null then
    v_missing := array_append(v_missing, 'team_tournament_can_manage');
  end if;
  if to_regprocedure('public.team_tournament_assert_tenant(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_assert_tenant');
  end if;
  if to_regprocedure('public.team_tournament_create(text,text,text,text,text,text,jsonb)') is null then
    v_missing := array_append(v_missing, 'team_tournament_create');
  end if;
  if to_regprocedure('public.team_tournament_commit_pairing(text,jsonb,jsonb,jsonb,integer)') is null then
    v_missing := array_append(v_missing, 'team_tournament_commit_pairing');
  end if;
  if to_regprocedure('public.private_pairing_get_active_rules_for_scope(text,text,text)') is null then
    v_missing := array_append(v_missing, 'private_pairing_get_active_rules_for_scope');
  end if;
  if to_regclass('public.private_pairing_rule_sets') is null then
    v_missing := array_append(v_missing, 'private_pairing_rule_sets');
  end if;
  if to_regclass('public.private_pairing_rules') is null then
    v_missing := array_append(v_missing, 'private_pairing_rules');
  end if;
  if to_regclass('public.private_pairing_rule_targets') is null then
    v_missing := array_append(v_missing, 'private_pairing_rule_targets');
  end if;
  if to_regprocedure('public.team_tournament_rename(text,text)') is not null then
    raise exception 'PRECHECK_FAIL: team_tournament_rename already exists';
  end if;
  if to_regprocedure('public.team_tournament_form_pairing_opaque(text,jsonb,text,text,text,text,boolean)') is not null then
    raise exception 'PRECHECK_FAIL: team_tournament_form_pairing_opaque already exists';
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception 'PRECHECK_FAIL: missing %', array_to_string(v_missing, ', ');
  end if;

  raise notice 'PRECHECK_PASS: team-tournament-staging-acceptance-remediation-01';
end $$;
