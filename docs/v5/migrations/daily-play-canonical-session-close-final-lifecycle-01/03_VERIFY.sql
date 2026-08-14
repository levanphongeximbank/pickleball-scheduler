-- Daily Play canonical session close + match-shape: post-apply verification.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Read-only. This implementation run did not apply Staging.

DO $$
DECLARE
  v_close text := 'public.daily_play_close_session(text,text,uuid,integer,text)';
  v_shape text := 'public.daily_play_match_shape(text)';
  v_validate text := 'public.daily_play_validate_match_shape(jsonb)';
  v_denied text := 'public.daily_play_session_write_denied(text)';
  v_def text;
  v_create_def text;
  v_correct_def text;
  v_snap_def text;
  v_rpc text;
  v_rpcs text[] := ARRAY[
    'public.daily_play_check_in(text,text,uuid,text,integer,text)',
    'public.daily_play_check_out(text,text,uuid,text,integer,text)',
    'public.daily_play_create_matches(text,text,uuid,jsonb,integer,integer,text)',
    'public.daily_play_assign_court(text,text,uuid,text,text,integer,text)',
    'public.daily_play_start_match(text,text,uuid,text,integer,text)',
    'public.daily_play_submit_score(text,text,uuid,text,integer,integer,integer,text)',
    'public.daily_play_cancel_match(text,text,uuid,text,integer,text)',
    'public.daily_play_change_court(text,text,uuid,text,text,integer,text)'
  ];
BEGIN
  IF to_regprocedure(v_close) IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: missing %', v_close;
  END IF;
  IF to_regprocedure(v_shape) IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: missing %', v_shape;
  END IF;
  IF to_regprocedure(v_validate) IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: missing %', v_validate;
  END IF;
  IF to_regprocedure(v_denied) IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: missing %', v_denied;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'daily_play_close_session'
      AND p.prosecdef
      AND coalesce(array_to_string(p.proconfig, ','), '') ILIKE '%search_path=public%'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: daily_play_close_session is not SECURITY DEFINER with search_path=public';
  END IF;

  IF NOT has_function_privilege('authenticated', v_close, 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: authenticated EXECUTE missing on %', v_close;
  END IF;
  IF has_function_privilege('anon', v_close, 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon can execute %', v_close;
  END IF;

  IF has_function_privilege('anon', v_shape, 'EXECUTE')
     OR has_function_privilege('authenticated', v_shape, 'EXECUTE')
     OR has_function_privilege('anon', v_validate, 'EXECUTE')
     OR has_function_privilege('authenticated', v_validate, 'EXECUTE')
     OR has_function_privilege('anon', v_denied, 'EXECUTE')
     OR has_function_privilege('authenticated', v_denied, 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: match-shape/session helpers must not be client-executable';
  END IF;

  FOREACH v_rpc IN ARRAY v_rpcs LOOP
    IF NOT has_function_privilege('authenticated', v_rpc, 'EXECUTE') THEN
      RAISE EXCEPTION 'VERIFY_FAIL: authenticated EXECUTE missing on %', v_rpc;
    END IF;
    IF has_function_privilege('anon', v_rpc, 'EXECUTE') THEN
      RAISE EXCEPTION 'VERIFY_FAIL: anon can execute %', v_rpc;
    END IF;
    v_def := pg_get_functiondef(v_rpc::regprocedure);
    IF v_def NOT ILIKE '%daily_play_session_write_denied%' THEN
      RAISE EXCEPTION 'VERIFY_FAIL: post-close guard missing from %', v_rpc;
    END IF;
  END LOOP;

  v_def := pg_get_functiondef(v_close::regprocedure);
  IF v_def NOT ILIKE '%SESSION_CLOSE_BLOCKED%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: SESSION_CLOSE_BLOCKED missing from close_session';
  END IF;
  IF v_def NOT ILIKE '%SESSION_ALREADY_COMPLETED%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: SESSION_ALREADY_COMPLETED missing from close_session';
  END IF;
  IF v_def NOT ILIKE '%VERSION_CONFLICT%' AND v_def NOT ILIKE '%daily_play_version_conflict%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: CAS missing from close_session';
  END IF;
  IF v_def NOT ILIKE '%session_closed%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: waiting cancellation reason missing';
  END IF;
  IF v_def NOT ILIKE '%completedMatchCount%'
     OR v_def NOT ILIKE '%cancelledWaitingCount%'
     OR v_def NOT ILIKE '%checkedInCountAtClose%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: closeSummary contract missing';
  END IF;
  IF v_def NOT ILIKE '%status = ''completed''%' AND v_def NOT ILIKE '%status=''completed''%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: tournament status completed missing from close_session';
  END IF;
  IF v_def ILIKE '%playerIds%' AND v_def ILIKE '%closeSummary%' AND v_def ILIKE '%jsonb_agg%player%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: closeSummary must not snapshot player lists';
  END IF;

  v_create_def := pg_get_functiondef(
    'public.daily_play_create_matches(text,text,uuid,jsonb,integer,integer,text)'::regprocedure
  );
  IF v_create_def NOT ILIKE '%daily_play_validate_match_shape%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: create_matches must use canonical match-shape helper';
  END IF;
  IF v_create_def ILIKE '%playersPerMatch%,4%' AND v_create_def NOT ILIKE '%daily_play_match_shape%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: create_matches still hardcodes doubles-only player count';
  END IF;

  v_correct_def := pg_get_functiondef(
    'public.daily_play_correct_score(text,text,uuid,text,integer,integer,integer,text,text)'::regprocedure
  );
  IF v_correct_def ILIKE '%daily_play_session_write_denied%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: correct_score must remain allowed after session close';
  END IF;
  IF v_correct_def ILIKE '%INSERT INTO public.daily_play_court_leases%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: correct_score must not create leases';
  END IF;

  v_snap_def := pg_get_functiondef(
    'public.daily_play_snapshot(text,text,uuid)'::regprocedure
  );
  IF v_snap_def NOT ILIKE '%tournamentStatus%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: snapshot missing tournamentStatus';
  END IF;
  IF v_snap_def NOT ILIKE '%occupiedCourtIds%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: occupancy occupiedCourtIds was removed from snapshot';
  END IF;
  IF to_regprocedure('public.daily_play_get_state(text,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: get_state was removed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'daily_play_court_leases_one_active_court_uidx'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: occupancy unique index missing';
  END IF;

  IF has_table_privilege('anon', 'public.daily_play_court_leases', 'SELECT')
     OR has_table_privilege('authenticated', 'public.daily_play_court_leases', 'SELECT')
     OR has_table_privilege('anon', 'public.daily_play_command_ledger', 'SELECT')
     OR has_table_privilege('authenticated', 'public.daily_play_command_ledger', 'SELECT') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: unexpected direct table grants on Daily Play leases/ledger';
  END IF;

  RAISE NOTICE 'VERIFY_OK: close_session, match-shape, post-close guards, occupancy snapshot present';
END
$$;

SELECT
  'RPC_CLOSE_SESSION_AUTHENTICATED_ONLY' AS check_item,
  'daily_play_close_session' AS value,
  has_function_privilege(
    'authenticated',
    'public.daily_play_close_session(text,text,uuid,integer,text)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.daily_play_close_session(text,text,uuid,integer,text)',
    'EXECUTE'
  ) AS ok;

SELECT 'STAGING_APPLIED_BY_THIS_RUN' AS check_item, 'NO' AS value, true AS ok;
SELECT 'COURT_TIME_ALLOCATION' AS check_item, 'NOT_IN_SCOPE' AS value, true AS ok;
SELECT 'CORRECT_SCORE_AFTER_CLOSE' AS check_item, 'ALLOWED_COMPLETED_MATCH_ONLY' AS value, true AS ok;
