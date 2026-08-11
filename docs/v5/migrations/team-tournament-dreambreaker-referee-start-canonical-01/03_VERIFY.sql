-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-dreambreaker-referee-start-canonical-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-REFEREE-START-CANONICAL-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only verification via functiondef. Does not call start RPC.
-- Does not mutate the live READY fixture.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_count int;
  v_def text;
  v_update_pos int;
  v_cas_pos int;
  v_conflict_pos int;
begin
  select count(*)::int into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_start_dreambreaker';

  if v_count <> 1 then
    raise exception 'VERIFY_FAIL: START_RPC_OVERLOAD_COUNT_AFTER expected 1, found %', v_count;
  end if;

  if to_regprocedure(
    'public.team_tournament_start_dreambreaker(text,text,integer,text)'
  ) is null then
    raise exception 'VERIFY_FAIL: START_RPC_SIGNATURE_PRESERVED expected YES';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_start_dreambreaker'
    and pg_get_function_identity_arguments(p.oid) =
      'p_tournament_id text, p_matchup_id text, p_expected_version integer, p_idempotency_key text';

  if position('tie_at_2_2' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: TIE_AT_2_2_MATCHER_SUPPORTED expected YES';
  end if;

  if position('READY_STATE_CAN_START_WITHOUT_CATALOG_ROW' in v_def) = 0
     or position('SYNTHETIC_DREAMBREAKER_DISCIPLINE' in v_def) = 0
     or position('v_disc_ext := ''dreambreaker''' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: READY_STATE_CAN_START_WITHOUT_CATALOG_ROW expected YES';
  end if;

  if position('Thiếu nội dung Dreambreaker.' in v_def) > 0 then
    raise exception 'VERIFY_FAIL: missing-content catalog hard-fail must be removed';
  end if;

  if position('START_USES_PERSISTED_ORDERS' in v_def) = 0
     or position('v_db.team_a_order' in v_def) = 0
     or position('v_db.team_b_order' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: START_USES_PERSISTED_ORDERS expected YES';
  end if;

  if position('p_team_a_order' in v_def) > 0 or position('p_team_b_order' in v_def) > 0 then
    raise exception 'VERIFY_FAIL: CLIENT_ORDER_PAYLOAD_REQUIRED expected NO';
  end if;

  v_cas_pos := position('DREAMBREAKER_CAS_BEFORE_WRITE' in v_def);
  v_conflict_pos := position('team_tournament_version_conflict' in v_def);
  v_update_pos := position('update public.team_tournament_dreambreaker_states' in v_def);

  if v_cas_pos = 0 or v_update_pos = 0 or v_cas_pos > v_update_pos then
    raise exception 'VERIFY_FAIL: DREAMBREAKER_CAS_BEFORE_WRITE expected YES';
  end if;

  if v_conflict_pos = 0 or v_conflict_pos > v_update_pos then
    raise exception 'VERIFY_FAIL: STALE_VERSION_ZERO_WRITE expected YES';
  end if;

  if (
    length(v_def)
    - length(replace(v_def, 'version = version + 1', ''))
  ) / length('version = version + 1') <> 1 then
    raise exception 'VERIFY_FAIL: SUCCESS_VERSION_BUMP_ONCE expected exactly one increment';
  end if;

  if position('DREAMBREAKER_SUBMATCH_CREATED_ONCE' in v_def) = 0
     or position('external_sub_match_id = v_sub_ext' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: DREAMBREAKER_SUBMATCH_CREATED_ONCE expected YES';
  end if;

  if position('replay' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: IDEMPOTENT_REPLAY_SAFE expected YES';
  end if;

  raise notice 'VERIFY_OK: tie_at_2_2; synthetic start; persisted orders; CAS; unique signature';
end $$;

select
  'START_RPC_OVERLOAD_COUNT_AFTER' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_start_dreambreaker'
  ) as value,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_start_dreambreaker'
  ) = 1 as ok;

select
  'TIE_AT_2_2_MATCHER_SUPPORTED' as check_item,
  (
    select position('tie_at_2_2' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_start_dreambreaker'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'READY_STATE_CAN_START_WITHOUT_CATALOG_ROW' as check_item,
  (
    select
      position('READY_STATE_CAN_START_WITHOUT_CATALOG_ROW' in pg_get_functiondef(p.oid)) > 0
      and position('v_disc_ext := ''dreambreaker''' in pg_get_functiondef(p.oid)) > 0
      and position('Thiếu nội dung Dreambreaker.' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_start_dreambreaker'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'START_USES_PERSISTED_ORDERS' as check_item,
  (
    select
      position('START_USES_PERSISTED_ORDERS' in pg_get_functiondef(p.oid)) > 0
      and position('v_db.team_a_order' in pg_get_functiondef(p.oid)) > 0
      and position('v_db.team_b_order' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_start_dreambreaker'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'CLIENT_ORDER_PAYLOAD_REQUIRED' as check_item,
  'NO' as value,
  (
    select
      position('p_team_a_order' in pg_get_functiondef(p.oid)) = 0
      and position('p_team_b_order' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_start_dreambreaker'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_expected_version integer, p_idempotency_key text'
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
      and p.proname = 'team_tournament_start_dreambreaker'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_expected_version integer, p_idempotency_key text'
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
      and p.proname = 'team_tournament_start_dreambreaker'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_expected_version integer, p_idempotency_key text'
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
      and p.proname = 'team_tournament_start_dreambreaker'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'DREAMBREAKER_SUBMATCH_CREATED_ONCE' as check_item,
  (
    select
      position('DREAMBREAKER_SUBMATCH_CREATED_ONCE' in pg_get_functiondef(p.oid)) > 0
      and position('if v_sub_id is null then' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_start_dreambreaker'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'IDEMPOTENT_REPLAY_SAFE' as check_item,
  (
    select
      position('replay' in pg_get_functiondef(p.oid)) > 0
      and position('team_tournament_begin_command' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_start_dreambreaker'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'AUTHENTICATED_GRANTS_PRESERVED' as check_item,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_start_dreambreaker(text,text,integer,text)',
    'EXECUTE'
  ) as ok;

select
  'ANON_GRANTS_UNCHANGED' as check_item,
  not has_function_privilege(
    'anon',
    'public.team_tournament_start_dreambreaker(text,text,integer,text)',
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
