-- Daily Play canonical score correction: dependency precheck only.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- This script is read-only. STAGING_MUTATIONS_THIS_RUN=0.

DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
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
  IF to_regprocedure('public.daily_play_version_conflict(integer,integer)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_version_conflict(integer,integer)');
  END IF;
  IF to_regprocedure('public.daily_play_replace_match(jsonb,text,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_replace_match(jsonb,text,jsonb)');
  END IF;
  IF to_regprocedure('public.daily_play_write_state(uuid,integer,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_write_state(uuid,integer,jsonb)');
  END IF;
  IF to_regprocedure('public.daily_play_submit_score(text,text,uuid,text,integer,integer,integer,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_submit_score(text,text,uuid,text,integer,integer,integer,text)');
  END IF;
  IF to_regprocedure('public.daily_play_get_state(text,text,uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_get_state(text,text,uuid)');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: missing Daily Play dependencies: %',
      array_to_string(v_missing, ', ');
  END IF;

  RAISE NOTICE 'PRECHECK_OK: Daily Play end-to-end canonical package is present';
END
$$;

SELECT 'STAGING_MUTATIONS' AS check_item, 0 AS value, true AS ok;
SELECT 'DO_NOT_APPLY_WITHOUT_OWNER_GO' AS check_item, 'YES' AS value, true AS ok;
