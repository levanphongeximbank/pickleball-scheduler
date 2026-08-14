-- Daily Play cross-tournament court occupancy: post-apply verification.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Read-only. This implementation run did not apply Staging.

DO $$
DECLARE
  v_snapshot_def text;
  v_get_state_def text;
  v_submit_def text;
  v_cancel_def text;
  v_idx text;
BEGIN
  IF to_regprocedure('public.daily_play_snapshot(text,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: missing daily_play_snapshot(text,text,uuid)';
  END IF;
  IF to_regprocedure('public.daily_play_get_state(text,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: missing daily_play_get_state(text,text,uuid)';
  END IF;

  SELECT indexdef INTO v_idx
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'daily_play_court_leases'
    AND indexname = 'daily_play_court_leases_one_active_court_uidx';
  IF v_idx IS NULL
     OR v_idx NOT ILIKE '%UNIQUE%'
     OR v_idx NOT ILIKE '%tenant_id, club_id, court_id%'
     OR v_idx NOT ILIKE '%WHERE (status = ''active''%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: unique active court index missing or changed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'daily_play_snapshot'
      AND p.prosecdef
      AND p.provolatile = 's'
      AND coalesce(array_to_string(p.proconfig, ','), '') ILIKE '%search_path=public%'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: daily_play_snapshot is not STABLE SECURITY DEFINER search_path=public';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'daily_play_get_state'
      AND p.prosecdef
      AND coalesce(array_to_string(p.proconfig, ','), '') ILIKE '%search_path=public%'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: daily_play_get_state is not SECURITY DEFINER search_path=public';
  END IF;

  IF has_function_privilege(
    'authenticated', 'public.daily_play_snapshot(text,text,uuid)', 'EXECUTE'
  ) OR has_function_privilege(
    'anon', 'public.daily_play_snapshot(text,text,uuid)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: snapshot helper is executable by a client role';
  END IF;

  IF NOT has_function_privilege(
    'authenticated', 'public.daily_play_get_state(text,text,uuid)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: authenticated EXECUTE missing on daily_play_get_state';
  END IF;
  IF has_function_privilege(
    'anon', 'public.daily_play_get_state(text,text,uuid)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon/PUBLIC can execute daily_play_get_state';
  END IF;

  IF has_table_privilege('anon', 'public.daily_play_court_leases', 'SELECT')
     OR has_table_privilege('authenticated', 'public.daily_play_court_leases', 'SELECT')
     OR has_table_privilege('anon', 'public.daily_play_court_leases', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.daily_play_court_leases', 'UPDATE') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: unexpected direct table grants on daily_play_court_leases';
  END IF;

  v_snapshot_def := pg_get_functiondef(
    'public.daily_play_snapshot(text,text,uuid)'::regprocedure
  );
  v_get_state_def := pg_get_functiondef(
    'public.daily_play_get_state(text,text,uuid)'::regprocedure
  );
  IF v_snapshot_def NOT ILIKE '%occupiedCourtIds%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: occupiedCourtIds missing from snapshot';
  END IF;
  IF v_snapshot_def NOT ILIKE '%activeLeases%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: activeLeases missing from snapshot';
  END IF;
  IF v_get_state_def NOT ILIKE '%daily_play_snapshot%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: get_state no longer returns snapshot';
  END IF;

  IF v_snapshot_def NOT ILIKE '%l.tournament_id = p_tournament_id%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: current-tournament lease detail scope lost';
  END IF;
  IF length(v_snapshot_def)
       - length(replace(v_snapshot_def, 'l.tournament_id = p_tournament_id', ''))
       <> length('l.tournament_id = p_tournament_id') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: occupancy query must not filter by tournament_id';
  END IF;
  IF v_snapshot_def NOT ILIKE '%jsonb_agg(l.court_id ORDER BY l.court_id)%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: occupiedCourtIds is not a sanitized court_id array';
  END IF;

  v_submit_def := pg_get_functiondef(
    'public.daily_play_submit_score(text,text,uuid,text,integer,integer,integer,text)'::regprocedure
  );
  v_cancel_def := pg_get_functiondef(
    'public.daily_play_cancel_match(text,text,uuid,text,integer,text)'::regprocedure
  );
  IF v_submit_def NOT ILIKE '%status=''released''%'
     AND v_submit_def NOT ILIKE '%status = ''released''%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: submit_score no longer releases court leases';
  END IF;
  IF v_cancel_def NOT ILIKE '%status=''released''%'
     AND v_cancel_def NOT ILIKE '%status = ''released''%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: cancel_match no longer releases court leases';
  END IF;

  RAISE NOTICE 'VERIFY_OK: club-wide occupiedCourtIds, lease isolation, unique index, grants';
END
$$;

SELECT
  'GLOBAL_OCCUPANCY_FIELD' AS check_item,
  'occupiedCourtIds' AS value,
  position(
    'occupiedCourtIds' IN pg_get_functiondef(
      'public.daily_play_snapshot(text,text,uuid)'::regprocedure
    )
  ) > 0 AS ok;

SELECT
  'ACTIVE_LEASE_UNIQUE_INDEX_UNCHANGED' AS check_item,
  indexdef AS value,
  indexdef ILIKE '%tenant_id, club_id, court_id%' AS ok
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'daily_play_court_leases'
  AND indexname = 'daily_play_court_leases_one_active_court_uidx';

SELECT
  'GET_STATE_AUTHENTICATED_ONLY' AS check_item,
  'daily_play_get_state' AS value,
  has_function_privilege(
    'authenticated', 'public.daily_play_get_state(text,text,uuid)', 'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon', 'public.daily_play_get_state(text,text,uuid)', 'EXECUTE'
  ) AS ok;

SELECT 'STAGING_APPLIED_BY_THIS_RUN' AS check_item, 'NO' AS value, true AS ok;
SELECT 'UNIQUE_ACTIVE_COURT_INDEX_CHANGED' AS check_item, 'NO' AS value, true AS ok;
SELECT 'TABLE_DML' AS check_item, 'NO' AS value, true AS ok;
SELECT 'LEASE_DATA_MUTATION' AS check_item, 'NO' AS value, true AS ok;
