-- Official/Open canonical court reservation 01: READ-ONLY precheck.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Does not create daily_play_court_leases. Does not replay Daily #424.

DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_lease_ends boolean := false;
  v_version_exists boolean := false;
BEGIN
  IF to_regclass('public.canonical_tournaments') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournaments');
  END IF;
  IF to_regclass('public.club_data_v3') IS NULL THEN
    v_missing := array_append(v_missing, 'public.club_data_v3');
  END IF;
  IF to_regclass('public.daily_play_court_leases') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_court_leases (Daily #424 runtime required; do not recreate)');
  END IF;
  IF to_regprocedure('public.canonical_tournament_assert_tenant(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournament_assert_tenant(text)');
  END IF;
  IF to_regprocedure('public.canonical_tournament_assert_permission(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournament_assert_permission(text)');
  END IF;
  IF to_regprocedure('public.daily_play_assign_court(text,text,uuid,text,text,integer,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_assign_court(...)');
  END IF;
  IF to_regprocedure('public.daily_play_change_court(text,text,uuid,text,text,integer,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_change_court(...)');
  END IF;
  IF to_regprocedure('public.daily_play_close_session(text,text,uuid,integer,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_close_session(...)');
  END IF;
  IF to_regprocedure('public.canonical_tournament_update(text,text,uuid,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournament_update(...)');
  END IF;
  IF to_regprocedure('public.user_has_permission(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.user_has_permission(text)');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: missing dependencies: %', array_to_string(v_missing, ', ');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='canonical_tournaments'
      AND column_name='payload' AND data_type='jsonb'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: canonical_tournaments.payload jsonb missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='canonical_tournaments'
      AND column_name='version'
  ) INTO v_version_exists;

  -- Daily lease must exist and must NOT be treated as a bounded calendar window.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='daily_play_court_leases'
      AND column_name='leased_at'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: daily_play_court_leases.leased_at missing';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='daily_play_court_leases'
      AND column_name IN ('ends_at', 'end_at', 'until_at')
  ) INTO v_lease_ends;
  IF v_lease_ends THEN
    RAISE NOTICE 'PRECHECK_NOTE: daily_play_court_leases has an end-time column; APPLY still treats only status=active as occupancy and will not invent duration';
  ELSE
    RAISE NOTICE 'PRECHECK_OK: DAILY_LEASE_BOUNDED_END_AUTHORITY=NO';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='daily_play_court_leases'
      AND indexname='daily_play_court_leases_one_active_court_uidx'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: daily_play_court_leases active unique index missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='btree_gist') THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: btree_gist is not installed. Apply official-open-canonical-court-reservation-01-btree-gist-prereq first. This package does not CREATE EXTENSION.';
  END IF;

  IF to_regclass('public.court_reservations') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='court_reservations' AND column_name='starts_at'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='court_reservations' AND column_name='ends_at'
    ) THEN
      RAISE EXCEPTION 'PRECHECK_FAIL: public.court_reservations exists with incompatible shape';
    END IF;
    RAISE NOTICE 'PRECHECK_OK: court_reservations already present; APPLY is additive/OR REPLACE';
  END IF;

  IF to_regclass('public.daily_play_courts') IS NOT NULL THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: forbidden daily_play_courts inventory table exists';
  END IF;

  RAISE NOTICE 'PRECHECK_OK: DAILY_424_RUNTIME_PRESENT=YES version_column_exists=%', v_version_exists;
END
$$;
