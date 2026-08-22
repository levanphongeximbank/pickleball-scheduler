-- Official/Open authenticated referee discovery: READ-ONLY precheck.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT SEPARATE OWNER GO STAGING.

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
  IF to_regprocedure('public.official_open_find_match(jsonb,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_find_match');
  END IF;
  IF to_regprocedure('public.official_open_entry_name(jsonb,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_entry_name');
  END IF;
  IF to_regprocedure('public.official_open_round_target(jsonb,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_round_target');
  END IF;
  IF to_regprocedure('public.official_open_json_err(text,text,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_json_err');
  END IF;
  IF to_regprocedure('public.user_venue_id()') IS NULL THEN
    v_missing := array_append(v_missing, 'user_venue_id');
  END IF;
  IF to_regprocedure('public.official_open_referee_get_match(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_referee_get_match(text)');
  END IF;
  IF to_regprocedure('public.official_open_adjust_live_score(text,text,integer,integer,integer)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_adjust_live_score(...)');
  END IF;
  IF to_regprocedure('public.official_open_commit_match_result(text,integer,integer,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_commit_match_result(...)');
  END IF;
  IF to_regprocedure('public.referee_get_match_by_token(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'referee_get_match_by_token(text)');
  END IF;
  IF to_regprocedure('public.referee_update_match_score(text,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'referee_update_match_score(text,jsonb)');
  END IF;
  IF to_regprocedure('public.canonical_ensure_internal_referee_match_live(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'canonical_ensure_internal_referee_match_live(text)');
  END IF;
  IF to_regprocedure('public.canonical_commit_internal_referee_match_result(text,integer,integer,bigint)') IS NULL THEN
    v_missing := array_append(v_missing, 'canonical_commit_internal_referee_match_result(...)');
  END IF;

  IF md5((
    SELECT p.prosrc FROM pg_proc p
    WHERE p.oid = 'public.official_open_referee_get_match(text)'::regprocedure
  )) IS DISTINCT FROM '505ae25db29a3955b58727c936655552'
     OR md5((
       SELECT p.prosrc FROM pg_proc p
       WHERE p.oid =
         'public.official_open_ensure_match_live(text,text,uuid,text,jsonb)'::regprocedure
     )) IS DISTINCT FROM 'f30cda881cd9238a5db0bb8b8a728c91'
     OR md5((
       SELECT p.prosrc FROM pg_proc p
       WHERE p.oid =
         'public.official_open_adjust_live_score(text,text,integer,integer,integer)'::regprocedure
     )) IS DISTINCT FROM '6e755f6c129b18b8fc70abcf2cefff11'
     OR md5((
       SELECT p.prosrc FROM pg_proc p
       WHERE p.oid =
         'public.official_open_commit_match_result(text,integer,integer,text)'::regprocedure
     )) IS DISTINCT FROM 'd1a290abdbbc278e438b936815bec4df'
     OR md5((
       SELECT p.prosrc FROM pg_proc p
       WHERE p.oid = 'public.referee_get_match_by_token(text)'::regprocedure
     )) IS DISTINCT FROM 'a5ba9f55da50c89651257b26048b2378'
     OR md5((
       SELECT p.prosrc FROM pg_proc p
       WHERE p.oid = 'public.referee_update_match_score(text,jsonb)'::regprocedure
     )) IS DISTINCT FROM '839d0eef8fb71d7bd50abe3a6c2c3328' THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: pre-discovery token RPC baseline changed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tournament_match_live'
      AND column_name = 'live_revision'
  ) THEN
    v_missing := array_append(v_missing, 'tournament_match_live.live_revision');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tournament_match_live'
      AND column_name = 'scoring_target'
  ) THEN
    v_missing := array_append(v_missing, 'tournament_match_live.scoring_target');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: missing dependencies: %', array_to_string(v_missing, ', ');
  END IF;

  RAISE NOTICE 'PRECHECK_OK: official-open-referee-discovery-01 dependencies present';
  RAISE NOTICE 'PRECHECK_OK: DISCOVERY_REQUIRES_LIVE_ROW=NO';
  RAISE NOTICE 'PRECHECK_OK: BACKFILL_REQUIRED=NO';
  RAISE NOTICE 'PRECHECK_OK: COURT_OBJECTS_UNTOUCHED';
END;
$$;
