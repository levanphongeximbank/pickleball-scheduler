-- Daily Play canonical session close + match-shape final lifecycle.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- This script is read-only. STAGING_MUTATIONS=0.

DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_create_count int;
  v_correct_count int;
BEGIN
  IF to_regclass('public.canonical_tournaments') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournaments');
  END IF;
  IF to_regclass('public.daily_play_court_leases') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_court_leases');
  END IF;
  IF to_regclass('public.daily_play_command_ledger') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_command_ledger');
  END IF;
  IF to_regprocedure('public.canonical_tournament_assert_tenant(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournament_assert_tenant(text)');
  END IF;
  IF to_regprocedure('public.canonical_tournament_assert_permission(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournament_assert_permission(text)');
  END IF;
  IF to_regprocedure('public.daily_play_begin_command(text,uuid,text,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_begin_command(text,uuid,text,text)');
  END IF;
  IF to_regprocedure('public.daily_play_finish_command(text,uuid,text,text,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_finish_command(text,uuid,text,text,jsonb)');
  END IF;
  IF to_regprocedure('public.daily_play_write_state(uuid,integer,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_write_state(uuid,integer,jsonb)');
  END IF;
  IF to_regprocedure('public.daily_play_get_state(text,text,uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_get_state(text,text,uuid)');
  END IF;
  IF to_regprocedure('public.daily_play_create_matches(text,text,uuid,jsonb,integer,integer,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_create_matches');
  END IF;
  IF to_regprocedure('public.daily_play_correct_score(text,text,uuid,text,integer,integer,integer,text,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_correct_score');
  END IF;
  IF to_regprocedure('public.daily_play_change_court(text,text,uuid,text,text,integer,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_change_court');
  END IF;
  IF to_regprocedure('public.daily_play_athlete_eligible_for_club(text,text,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_athlete_eligible_for_club(text,text,text)');
  END IF;
  IF to_regprocedure('public.team_tournament_normalize_gender_key(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.team_tournament_normalize_gender_key(text)');
  END IF;
  IF to_regclass('public.athletes') IS NULL THEN
    v_missing := array_append(v_missing, 'public.athletes');
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    v_missing := array_append(v_missing, 'public.profiles');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'athletes' AND column_name = 'user_id'
  ) THEN
    v_missing := array_append(v_missing, 'public.athletes.user_id');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'gender'
  ) THEN
    v_missing := array_append(v_missing, 'public.profiles.gender');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: missing dependencies: %', array_to_string(v_missing, ', ');
  END IF;

  SELECT count(*) INTO v_create_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'daily_play_create_matches';
  IF v_create_count <> 1 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: unexpected daily_play_create_matches overload count=%', v_create_count;
  END IF;

  SELECT count(*) INTO v_correct_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'daily_play_correct_score';
  IF v_correct_count <> 1 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: unexpected daily_play_correct_score overload count=%', v_correct_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'canonical_tournaments'
      AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: canonical_tournaments.status missing';
  END IF;

  RAISE NOTICE 'PRECHECK_OK: Daily Play close/match-shape dependencies present';
END
$$;

SELECT 'STAGING_MUTATIONS' AS check_item, 0 AS value, true AS ok;
SELECT 'DO_NOT_APPLY_WITHOUT_OWNER_GO' AS check_item, 'YES' AS value, true AS ok;
SELECT 'COURT_TIME_ALLOCATION' AS check_item, 'NOT_IN_SCOPE' AS value, true AS ok;
