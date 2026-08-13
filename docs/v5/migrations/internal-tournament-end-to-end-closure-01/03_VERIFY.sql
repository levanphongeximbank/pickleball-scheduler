-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: internal-tournament-end-to-end-closure-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Structural proofs only here. Functional mutation probes are reserved
-- for the controlled Staging runbook (transactional / rollback-safe).
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_has_version boolean;
  v_update_def text;
  v_create_def text;
  v_helper_exists boolean;
  v_completion_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'canonical_tournaments'
      AND column_name = 'version'
  ) INTO v_has_version;

  IF NOT v_has_version THEN
    RAISE EXCEPTION 'VERIFY_FAIL: canonical_tournaments.version missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'canonical_tournament_assert_internal_status_transition'
  ) INTO v_helper_exists;

  IF NOT v_helper_exists THEN
    RAISE EXCEPTION 'VERIFY_FAIL: assert_internal_status_transition missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'canonical_tournament_assert_internal_completion_eligible'
  ) INTO v_completion_exists;

  IF NOT v_completion_exists THEN
    RAISE EXCEPTION 'VERIFY_FAIL: assert_internal_completion_eligible missing';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_update_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'canonical_tournament_update'
    AND pg_get_function_identity_arguments(p.oid) = 'p_tenant_id text, p_club_id text, p_tournament_id uuid, p_patch jsonb';

  IF v_update_def IS NULL OR position('VERSION_CONFLICT' in v_update_def) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: update missing VERSION_CONFLICT CAS';
  END IF;

  IF position('VERSION_REQUIRED' in v_update_def) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: update missing VERSION_REQUIRED fail-closed for Internal';
  END IF;

  IF position('expected_version' in v_update_def) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: update missing expected_version';
  END IF;

  IF position('internal_tournament' in v_update_def) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: update missing Internal mode CAS gate';
  END IF;

  IF position('canonical_tournament_assert_internal_status_transition' in v_update_def) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: update missing internal status transition assert';
  END IF;

  IF position('incomplete_matches' in v_update_def) = 0
     AND position('canonical_tournament_assert_internal_completion_eligible' in v_update_def) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: update missing completion eligibility assert';
  END IF;

  IF position('v_current.payload' in v_update_def) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: completion gate must use pre-patch v_current.payload';
  END IF;

  IF position('INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE' in v_update_def) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: update missing INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE';
  END IF;

  IF position('force_status_reopen' in v_update_def) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: update missing force_status_reopen';
  END IF;

  IF position('t.version + 1' in v_update_def) = 0
     AND position('version = t.version + 1' in v_update_def) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: update does not bump version';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_create_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'canonical_tournament_create'
    AND pg_get_function_identity_arguments(p.oid) = 'p_tenant_id text, p_club_id text, p_payload jsonb';

  IF v_create_def IS NULL OR position('version' in lower(v_create_def)) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: create missing version seed';
  END IF;

  IF has_function_privilege('anon', 'public.canonical_tournament_update(text,text,uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon can execute canonical_tournament_update';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.canonical_tournament_update(text,text,uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: authenticated missing execute on update';
  END IF;

  RAISE NOTICE 'VERIFY_OK: internal-tournament-end-to-end-closure-01 structural contract present';
  RAISE NOTICE 'VERIFY_NOTE: functional CAS/completion probes reserved for Staging runbook (not executed here).';
END $$;
