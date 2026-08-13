-- Daily Play end-to-end canonical remediation: dependency precheck only.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- This script is read-only.

DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.canonical_tournaments') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournaments');
  END IF;
  IF to_regclass('public.club_data_v3') IS NULL THEN
    v_missing := array_append(v_missing, 'public.club_data_v3');
  END IF;
  IF to_regclass('public.athletes') IS NULL THEN
    v_missing := array_append(v_missing, 'public.athletes');
  END IF;
  IF to_regclass('public.club_members') IS NULL THEN
    v_missing := array_append(v_missing, 'public.club_members');
  END IF;
  IF to_regclass('public.clubs') IS NULL THEN
    v_missing := array_append(v_missing, 'public.clubs');
  END IF;
  IF to_regprocedure('public.canonical_tournament_assert_tenant(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournament_assert_tenant(text)');
  END IF;
  IF to_regprocedure('public.canonical_tournament_assert_permission(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournament_assert_permission(text)');
  END IF;
  IF to_regprocedure('public.user_venue_id()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.user_venue_id()');
  END IF;
  IF to_regprocedure('public.user_has_permission(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.user_has_permission(text)');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: missing dependencies: %', array_to_string(v_missing, ', ');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'canonical_tournaments'
      AND column_name = 'payload' AND data_type = 'jsonb'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: canonical_tournaments.payload jsonb missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'club_data_v3'
      AND column_name = 'data' AND data_type = 'jsonb'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: club_data_v3.data jsonb missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clubs'
      AND column_name = 'deleted_at'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: clubs.deleted_at missing';
  END IF;

  RAISE NOTICE 'PRECHECK_OK: canonical tournament, athlete membership, court SSOT, and auth dependencies exist';
END
$$;

SELECT 'STAGING_MUTATIONS' AS check_item, 0 AS value, true AS ok;
SELECT 'COURT_SOURCE' AS check_item, 'public.club_data_v3.data.courts' AS value, true AS ok;
SELECT 'DAILY_PLAY_COURTS_INVENTORY_CREATED' AS check_item, 'NO' AS value, true AS ok;
