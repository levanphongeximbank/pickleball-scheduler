-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-dreambreaker-submit-auth-privacy-01
-- Workstream: TEAM-TOURNAMENT-PR412-CAPTAIN-DREAMBREAKER-SUBMIT-CANONICAL-AUTH-PRIVACY-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only inventory. No data mutation. No Dreambreaker order write.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_count int;
  v_def text;
begin
  select count(*)::int into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_submit_dreambreaker_order';

  if v_count <> 1 then
    raise exception 'PRECHECK_FAIL: DREAMBREAKER_SUBMIT_RPC_OVERLOAD_COUNT_BEFORE expected 1, found %', v_count;
  end if;

  if to_regprocedure(
    'public.team_tournament_submit_dreambreaker_order(text,text,text,jsonb,integer,text)'
  ) is null then
    raise exception 'PRECHECK_FAIL: DREAMBREAKER_SUBMIT_SIGNATURE_MATCH expected YES';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_submit_dreambreaker_order'
    and pg_get_function_identity_arguments(p.oid) =
      'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text';

  if v_def is null then
    raise exception 'PRECHECK_FAIL: cannot load submit Dreambreaker definition';
  end if;

  if position('security definer' in lower(v_def)) = 0 then
    raise exception 'PRECHECK_FAIL: expected SECURITY DEFINER';
  end if;

  if position('team_tournament_guard_captain_portal_write' in v_def) = 0 then
    raise exception 'PRECHECK_FAIL: CURRENT_CAPTAIN_CAS_VALIDATION expected YES (captain write gate missing)';
  end if;

  if position('p_expected_version' in v_def) = 0
     or position('team_tournament_version_conflict' in v_def) = 0 then
    raise exception 'PRECHECK_FAIL: CURRENT_CAPTAIN_CAS_VALIDATION expected YES (CAS missing)';
  end if;

  if position('MATCHUP_PARTICIPANT_ASSERTION' in v_def) > 0 then
    raise exception 'PRECHECK_FAIL: CURRENT_PARTICIPANT_TEAM_ASSERTION expected missing';
  end if;

  if position('''teamAOrder''' in v_def) = 0
     or position('''teamBOrder''' in v_def) = 0 then
    raise exception 'PRECHECK_FAIL: CURRENT_RESPONSE_EXPOSES_BOTH_ORDERS expected YES';
  end if;

  raise notice 'PRECHECK_OK: unique submit RPC; participant assertion missing; both orders leaked; captain/CAS present';
end $$;

select
  'DREAMBREAKER_SUBMIT_RPC_OVERLOAD_COUNT_BEFORE' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
  ) as value,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
  ) = 1 as ok;

select
  'DREAMBREAKER_SUBMIT_SIGNATURE_MATCH' as check_item,
  to_regprocedure(
    'public.team_tournament_submit_dreambreaker_order(text,text,text,jsonb,integer,text)'
  ) is not null as ok;

select
  'CURRENT_PARTICIPANT_TEAM_ASSERTION_MISSING' as check_item,
  (
    select position('MATCHUP_PARTICIPANT_ASSERTION' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'CURRENT_RESPONSE_EXPOSES_BOTH_ORDERS' as check_item,
  (
    select
      position('''teamAOrder''' in pg_get_functiondef(p.oid)) > 0
      and position('''teamBOrder''' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'CURRENT_CAPTAIN_CAS_VALIDATION' as check_item,
  (
    select
      position('team_tournament_guard_captain_portal_write' in pg_get_functiondef(p.oid)) > 0
      and position('team_tournament_version_conflict' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'GRANTS_BASELINE_CAPTURED' as check_item,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_submit_dreambreaker_order(text,text,text,jsonb,integer,text)',
    'EXECUTE'
  ) as auth_exec,
  has_function_privilege(
    'anon',
    'public.team_tournament_submit_dreambreaker_order(text,text,text,jsonb,integer,text)',
    'EXECUTE'
  ) as anon_exec,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_submit_dreambreaker_order(text,text,text,jsonb,integer,text)',
    'EXECUTE'
  ) as ok;

select
  'no_data_mutation' as check_item,
  true as ok;
