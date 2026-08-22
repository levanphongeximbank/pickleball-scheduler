-- Official/Open referee-to-completion 01: READ-ONLY precheck.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Does not mutate canonical_tournaments rows or the Staging fixture.

DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.canonical_tournaments') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournaments');
  END IF;
  IF to_regclass('public.tournament_match_live') IS NULL THEN
    v_missing := array_append(v_missing, 'public.tournament_match_live');
  END IF;
  IF to_regprocedure('public.canonical_tournament_assert_tenant(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournament_assert_tenant(text)');
  END IF;
  IF to_regprocedure('public.canonical_tournament_assert_permission(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournament_assert_permission(text)');
  END IF;
  IF to_regprocedure('public.canonical_tournament_update(text,text,uuid,jsonb,bigint)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournament_update(text,text,uuid,jsonb,bigint)');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: missing dependencies: %', array_to_string(v_missing, ', ');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'canonical_tournaments'
      AND column_name = 'payload' AND data_type = 'jsonb'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: canonical_tournaments.payload jsonb missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'canonical_tournaments'
      AND column_name = 'version'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: canonical_tournaments.version missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tournament_match_live'
      AND column_name = 'referee_token'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: tournament_match_live.referee_token missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tournament_match_live'
      AND column_name = 'score_a'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: tournament_match_live.score_a missing';
  END IF;

  RAISE NOTICE 'PRECHECK_OK: official-open-referee-to-completion-01 dependencies present';
  RAISE NOTICE 'PRECHECK_OK: CANONICAL_VERSION_AUTHORITY=canonical_tournaments.version';
  RAISE NOTICE 'PRECHECK_OK: SIDEOUT_PACKAGE_NOT_REQUIRED_FOR_THIS_APPLY';
  RAISE NOTICE 'PRECHECK_OK: COURT_RESERVATION_OBJECTS_UNTOUCHED';
END;
$$;
