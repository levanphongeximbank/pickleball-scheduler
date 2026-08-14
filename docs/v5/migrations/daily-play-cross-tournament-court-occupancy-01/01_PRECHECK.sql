-- Daily Play cross-tournament court occupancy: dependency precheck only.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- This script is read-only. STAGING_MUTATIONS=0.

DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_snapshot_count int;
  v_get_state_count int;
  v_snapshot_def text;
  v_idx text;
BEGIN
  IF to_regclass('public.canonical_tournaments') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournaments');
  END IF;
  IF to_regclass('public.daily_play_court_leases') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_court_leases');
  END IF;

  IF to_regprocedure('public.daily_play_snapshot(text,text,uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_snapshot(text,text,uuid)');
  END IF;
  IF to_regprocedure('public.daily_play_get_state(text,text,uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_get_state(text,text,uuid)');
  END IF;
  IF to_regprocedure('public.canonical_tournament_assert_tenant(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournament_assert_tenant(text)');
  END IF;
  IF to_regprocedure('public.canonical_tournament_assert_permission(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournament_assert_permission(text)');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: missing Daily Play dependencies: %',
      array_to_string(v_missing, ', ');
  END IF;

  SELECT count(*) INTO v_snapshot_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'daily_play_snapshot';
  IF v_snapshot_count <> 1 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: unexpected daily_play_snapshot overload count=%',
      v_snapshot_count;
  END IF;

  SELECT count(*) INTO v_get_state_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'daily_play_get_state';
  IF v_get_state_count <> 1 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: unexpected daily_play_get_state overload count=%',
      v_get_state_count;
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
    RAISE EXCEPTION 'PRECHECK_FAIL: missing unique active court protection';
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
    RAISE EXCEPTION 'PRECHECK_FAIL: daily_play_snapshot is not STABLE SECURITY DEFINER search_path=public';
  END IF;

  v_snapshot_def := pg_get_functiondef(
    'public.daily_play_snapshot(text,text,uuid)'::regprocedure
  );
  IF v_snapshot_def NOT ILIKE '%activeLeases%' THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: unexpected snapshot contract, activeLeases missing';
  END IF;
  IF v_snapshot_def NOT ILIKE '%l.tournament_id = p_tournament_id%' THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: unexpected snapshot lease-detail scope';
  END IF;

  IF v_snapshot_def ILIKE '%occupiedCourtIds%' THEN
    IF v_snapshot_def NOT ILIKE '%jsonb_agg(l.court_id ORDER BY l.court_id)%' THEN
      RAISE EXCEPTION 'PRECHECK_FAIL: conflicting occupancy implementation is not a sanitized court_id array';
    END IF;
    IF length(v_snapshot_def)
         - length(replace(v_snapshot_def, 'l.tournament_id = p_tournament_id', ''))
         <> length('l.tournament_id = p_tournament_id') THEN
      RAISE EXCEPTION 'PRECHECK_FAIL: conflicting occupancy implementation changes lease-detail tournament scope';
    END IF;
    RAISE NOTICE 'PRECHECK_NOTICE: occupiedCourtIds already present; APPLY is CREATE OR REPLACE idempotent';
  END IF;

  RAISE NOTICE 'PRECHECK_OK: Daily Play snapshot/get_state and unique active court index present';
END
$$;

SELECT
  'SNAPSHOT_PRESTATE_MD5' AS check_item,
  md5(pg_get_functiondef('public.daily_play_snapshot(text,text,uuid)'::regprocedure)) AS value,
  true AS ok;

SELECT
  'GET_STATE_PRESTATE_MD5' AS check_item,
  md5(pg_get_functiondef('public.daily_play_get_state(text,text,uuid)'::regprocedure)) AS value,
  true AS ok;

SELECT
  'ACTIVE_LEASE_UNIQUE_INDEX' AS check_item,
  indexdef AS value,
  true AS ok
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'daily_play_court_leases'
  AND indexname = 'daily_play_court_leases_one_active_court_uidx';

SELECT 'STAGING_MUTATIONS' AS check_item, 0 AS value, true AS ok;
SELECT 'DO_NOT_APPLY_WITHOUT_OWNER_GO' AS check_item, 'YES' AS value, true AS ok;
