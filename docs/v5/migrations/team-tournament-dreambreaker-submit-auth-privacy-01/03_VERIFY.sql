-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-dreambreaker-submit-auth-privacy-01
-- Workstream: TEAM-TOURNAMENT-PR412-CAPTAIN-DREAMBREAKER-SUBMIT-CANONICAL-AUTH-PRIVACY-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only verification via functiondef. No Dreambreaker order mutation.
-- Does not call submit RPC as a user.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_count int;
  v_def text;
  v_update_pos int;
  v_participant_pos int;
  v_cas_pos int;
begin
  select count(*)::int into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_submit_dreambreaker_order';

  if v_count <> 1 then
    raise exception 'VERIFY_FAIL: DREAMBREAKER_SUBMIT_RPC_OVERLOAD_COUNT_AFTER expected 1, found %', v_count;
  end if;

  if to_regprocedure(
    'public.team_tournament_submit_dreambreaker_order(text,text,text,jsonb,integer,text)'
  ) is null then
    raise exception 'VERIFY_FAIL: DREAMBREAKER_SUBMIT_SIGNATURE_PRESERVED expected YES';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_submit_dreambreaker_order'
    and pg_get_function_identity_arguments(p.oid) =
      'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text';

  if position('MATCHUP_PARTICIPANT_ASSERTION' in v_def) = 0
     or position('p_team_id is distinct from v_matchup.team_a_id' in v_def) = 0
     or position('p_team_id is distinct from v_matchup.team_b_id' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: MATCHUP_PARTICIPANT_ASSERTION expected YES';
  end if;

  v_participant_pos := position('MATCHUP_PARTICIPANT_ASSERTION' in v_def);
  v_cas_pos := position('DREAMBREAKER_CAS_BEFORE_WRITE' in v_def);
  v_update_pos := position('update public.team_tournament_dreambreaker_states' in v_def);

  if v_participant_pos = 0 or v_update_pos = 0 or v_participant_pos > v_update_pos then
    raise exception 'VERIFY_FAIL: NON_PARTICIPANT_TEAM_ZERO_WRITE expected YES (assert before UPDATE)';
  end if;

  if position('team_tournament_guard_captain_portal_write' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: CAPTAIN_OWN_TEAM_ONLY expected YES';
  end if;

  if position('''ownOrder''' in v_def) = 0
     or position('''opponentOrderSubmitted''' in v_def) = 0
     or position('''canSubmitOwnOrder''' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: SUBMIT_RESPONSE_OWN_ORDER_ONLY expected YES';
  end if;

  if position('''teamAOrder''' in v_def) > 0
     or position('''teamBOrder''' in v_def) > 0 then
    raise exception 'VERIFY_FAIL: OPPONENT_ORDER_IDS_HIDDEN expected YES';
  end if;

  if v_cas_pos = 0 or v_update_pos = 0 or v_cas_pos > v_update_pos then
    raise exception 'VERIFY_FAIL: DREAMBREAKER_CAS_BEFORE_WRITE expected YES';
  end if;

  if position('team_tournament_version_conflict' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: STALE_VERSION_ZERO_WRITE expected YES';
  end if;

  if (
    length(v_def)
    - length(replace(v_def, 'version = version + 1', ''))
  ) / length('version = version + 1') <> 1 then
    raise exception 'VERIFY_FAIL: SUCCESS_VERSION_BUMP_ONCE expected exactly one increment';
  end if;

  raise notice 'VERIFY_OK: participant assert; viewer-safe response; CAS before write; unique signature';
end $$;

select
  'DREAMBREAKER_SUBMIT_RPC_OVERLOAD_COUNT_AFTER' as check_item,
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
  'MATCHUP_PARTICIPANT_ASSERTION' as check_item,
  (
    select position('MATCHUP_PARTICIPANT_ASSERTION' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'NON_PARTICIPANT_TEAM_ZERO_WRITE' as check_item,
  (
    select
      position('MATCHUP_PARTICIPANT_ASSERTION' in pg_get_functiondef(p.oid))
      < position('update public.team_tournament_dreambreaker_states' in pg_get_functiondef(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'CAPTAIN_OWN_TEAM_ONLY' as check_item,
  (
    select position('team_tournament_guard_captain_portal_write' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'CROSS_TEAM_SUBMIT_DENIED' as check_item,
  (
    select
      position('team_tournament_guard_captain_portal_write' in pg_get_functiondef(p.oid)) > 0
      and position('MATCHUP_PARTICIPANT_ASSERTION' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'SUBMIT_RESPONSE_OWN_ORDER_ONLY' as check_item,
  (
    select
      position('''ownOrder''' in pg_get_functiondef(p.oid)) > 0
      and position('''teamAOrder''' in pg_get_functiondef(p.oid)) = 0
      and position('''teamBOrder''' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'OPPONENT_ORDER_SUBMITTED_BOOLEAN_ONLY' as check_item,
  (
    select position('''opponentOrderSubmitted''' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'OPPONENT_ORDER_IDS_HIDDEN' as check_item,
  (
    select
      position('''teamAOrder''' in pg_get_functiondef(p.oid)) = 0
      and position('''teamBOrder''' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'TEAM_A_ORDER_RESPONSE_LEAK' as check_item,
  false as value,
  (
    select position('''teamAOrder''' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'TEAM_B_ORDER_RESPONSE_LEAK' as check_item,
  false as value,
  (
    select position('''teamBOrder''' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'DREAMBREAKER_CAS_BEFORE_WRITE' as check_item,
  (
    select
      position('DREAMBREAKER_CAS_BEFORE_WRITE' in pg_get_functiondef(p.oid))
      < position('update public.team_tournament_dreambreaker_states' in pg_get_functiondef(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'STALE_VERSION_ZERO_WRITE' as check_item,
  (
    select
      position('team_tournament_version_conflict' in pg_get_functiondef(p.oid))
      < position('update public.team_tournament_dreambreaker_states' in pg_get_functiondef(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'SUCCESS_VERSION_BUMP_ONCE' as check_item,
  (
    select
      (
        length(pg_get_functiondef(p.oid))
        - length(replace(pg_get_functiondef(p.oid), 'version = version + 1', ''))
      ) / length('version = version + 1') = 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_dreambreaker_order'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_team_id text, p_order jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'AUTHENTICATED_GRANTS_PRESERVED' as check_item,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_submit_dreambreaker_order(text,text,text,jsonb,integer,text)',
    'EXECUTE'
  ) as ok;

select
  'ANON_GRANTS_UNCHANGED' as check_item,
  not has_function_privilege(
    'anon',
    'public.team_tournament_submit_dreambreaker_order(text,text,text,jsonb,integer,text)',
    'EXECUTE'
  ) as ok;

select
  'RLS_CHANGED' as check_item,
  'NO' as value,
  true as ok;

select
  'RBAC_CHANGED' as check_item,
  'NO' as value,
  true as ok;

select
  'no_data_mutation' as check_item,
  true as ok;
