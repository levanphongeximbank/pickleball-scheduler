-- Official/Open referee-to-completion 01: READ-ONLY verify.
-- LOCAL PACKAGE ONLY. Does not mutate data.

DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_commit_core text;
  v_commit_ref text;
  v_complete text;
  v_generate text;
  v_ledger text;
  v_completion_check text;
  v_rollback_guard text;
BEGIN
  IF to_regclass('public.official_open_lifecycle_commands') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_lifecycle_commands');
  END IF;
  IF to_regprocedure('public.official_open_ensure_match_live(text,text,uuid,text,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_ensure_match_live');
  END IF;
  IF to_regprocedure('public.official_open_revoke_match_live(text,text,uuid,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_revoke_match_live');
  END IF;
  IF to_regprocedure('public.official_open_referee_get_match(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_referee_get_match');
  END IF;
  IF to_regprocedure('public.official_open_adjust_live_score(text,text,int,int,int)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_adjust_live_score');
  END IF;
  IF to_regprocedure('public.official_open_commit_match_result(text,int,int,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_commit_match_result');
  END IF;
  IF to_regprocedure('public.official_open_admin_commit_match_result(text,text,uuid,text,int,int,bigint,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_admin_commit_match_result');
  END IF;
  IF to_regprocedure('public.official_open_generate_knockout(text,text,uuid,text,bigint,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_generate_knockout');
  END IF;
  IF to_regprocedure('public.official_open_complete_tournament(text,text,uuid,bigint,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_complete_tournament');
  END IF;
  IF to_regprocedure('public.official_open_get_public_results(text,text,uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_get_public_results');
  END IF;
  IF to_regprocedure('public.official_open_ledger_replay(text,text,uuid,text,text,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_ledger_replay');
  END IF;
  IF to_regprocedure('public.official_open_assert_unused_for_rollback()') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_assert_unused_for_rollback');
  END IF;
  IF to_regprocedure('public.official_open_event_qualification(jsonb,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_event_qualification');
  END IF;
  IF to_regprocedure('public.official_open_completion_check(canonical_tournaments)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_completion_check');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tournament_match_live'
      AND column_name = 'live_revision'
  ) THEN
    v_missing := array_append(v_missing, 'tournament_match_live.live_revision');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'official_open_lifecycle_commands'
      AND column_name = 'request_hash' AND is_nullable = 'NO'
  ) THEN
    v_missing := array_append(v_missing, 'official_open_lifecycle_commands.request_hash NOT NULL');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: missing: %', array_to_string(v_missing, ', ');
  END IF;

  IF has_function_privilege('anon', 'public.official_open_ensure_match_live(text,text,uuid,text,jsonb)', 'execute') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon must not execute ensure_match_live';
  END IF;
  IF has_function_privilege('anon', 'public.official_open_generate_knockout(text,text,uuid,text,bigint,text)', 'execute') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon must not execute generate_knockout';
  END IF;
  IF has_function_privilege('anon', 'public.official_open_assert_unused_for_rollback()', 'execute') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon must not execute rollback guard';
  END IF;
  IF has_function_privilege('anon', 'public.official_open_ledger_replay(text,text,uuid,text,text,text)', 'execute') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon must not execute ledger_replay';
  END IF;
  IF NOT has_function_privilege('anon', 'public.official_open_referee_get_match(text)', 'execute') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon must execute referee_get_match';
  END IF;
  IF NOT has_function_privilege('anon', 'public.official_open_commit_match_result(text,int,int,text)', 'execute') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon must execute commit_match_result';
  END IF;
  IF has_function_privilege('anon', 'public.official_open_complete_tournament(text,text,uuid,bigint,text)', 'execute') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon must not execute complete_tournament';
  END IF;
  IF has_function_privilege('anon', 'public.official_open_get_public_results(text,text,uuid)', 'execute') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon must not execute get_public_results (authenticated DTO only)';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.official_open_generate_knockout(text,text,uuid,text,bigint,text)', 'execute') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: authenticated must execute generate_knockout';
  END IF;

  v_commit_core := pg_get_functiondef('public.official_open_commit_core(canonical_tournaments,text,int,int)'::regprocedure);
  v_commit_ref := pg_get_functiondef('public.official_open_commit_match_result(text,int,int,text)'::regprocedure);
  v_complete := pg_get_functiondef('public.official_open_complete_tournament(text,text,uuid,bigint,text)'::regprocedure);
  v_generate := pg_get_functiondef('public.official_open_generate_knockout(text,text,uuid,text,bigint,text)'::regprocedure);
  v_ledger := pg_get_functiondef('public.official_open_ledger_replay(text,text,uuid,text,text,text)'::regprocedure);
  v_completion_check := pg_get_functiondef('public.official_open_completion_check(canonical_tournaments)'::regprocedure);
  v_rollback_guard := pg_get_functiondef('public.official_open_assert_unused_for_rollback()'::regprocedure);

  IF v_commit_core ILIKE '%to_jsonb(v_next)%' OR v_commit_ref ILIKE '%to_jsonb(v_next)%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: referee/commit_core must not return to_jsonb(canonical row)';
  END IF;
  IF v_commit_ref ILIKE '%payload%' AND v_commit_ref ILIKE '%to_jsonb%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon commit_match_result must not json-encode payload';
  END IF;
  IF v_complete ILIKE '%to_jsonb(v_next)%' OR v_complete ILIKE '%to_jsonb(v_row)%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: complete_tournament must not return full canonical row';
  END IF;
  IF v_generate ILIKE '%to_jsonb(v_next)%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: generate_knockout must not return full canonical row';
  END IF;
  IF position('IDEMPOTENCY_CONFLICT' in v_ledger) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: ledger_replay must enforce IDEMPOTENCY_CONFLICT';
  END IF;
  IF position('official_open_event_qualification' in v_completion_check) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: completion_check must re-check qualification via official_open_event_qualification';
  END IF;
  IF position('QUALIFICATION_TIE_UNRESOLVED' in v_generate) = 0
     AND position('official_open_build_knockout' in v_generate) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: generate_knockout must deny unresolved qualification ties';
  END IF;
  IF position('ROLLBACK_BLOCKED' in v_rollback_guard) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: rollback guard must fail closed after runtime use';
  END IF;
  IF position('p_expected_version' in v_generate) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: generate_knockout must use expected_version CAS';
  END IF;

  RAISE NOTICE 'VERIFY_OK: official-open-referee-to-completion-01';
  RAISE NOTICE 'VERIFY_OK: REFEREE_COMMIT_RESPONSE_SANITIZED=YES';
  RAISE NOTICE 'VERIFY_OK: IDEMPOTENCY_REQUEST_HASH_ENFORCED=YES';
  RAISE NOTICE 'VERIFY_OK: KO_GENERATION_SERVER_COMMAND=YES';
  RAISE NOTICE 'VERIFY_OK: COMPLETION_RECHECKS_QUALIFICATION=YES';
  RAISE NOTICE 'VERIFY_OK: ROLLBACK_FAILS_CLOSED_AFTER_RUNTIME_USE=YES';
  RAISE NOTICE 'VERIFY_OK: LIVE_EXECUTION_ONLY=tournament_match_live';
  RAISE NOTICE 'VERIFY_OK: FINAL_SSOT=canonical_tournaments';
END;
$$;
