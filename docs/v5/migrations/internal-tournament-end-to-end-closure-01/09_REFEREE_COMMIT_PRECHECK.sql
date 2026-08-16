-- ═══════════════════════════════════════════════════════════════════
-- 09_REFEREE_COMMIT_PRECHECK.sql
-- Package: internal-tournament-end-to-end-closure-01 (additive follow-up)
-- Workstream: IT-E2E-BROWSER-017
-- STAGING ONLY. Do not apply to Production.
-- SQL_APPLIED=NO until explicit Owner GO.
--
-- STAGING_PROJECT=qyewbxjsiiyufanzcjcq
-- PRODUCTION_PROJECT=expuvcohlcjzvrrauvud
-- TARGET_IS_STAGING=YES
-- TARGET_IS_PRODUCTION=NO
--
-- Requires 01–04 CAS + 05–08 Internal referee runtime ensure.
-- Does not rewrite that history.
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_missing text[] := '{}';
BEGIN
  IF to_regclass('public.canonical_tournaments') IS NULL THEN
    v_missing := array_append(v_missing, 'canonical_tournaments');
  END IF;

  IF to_regclass('public.tournament_match_live') IS NULL THEN
    v_missing := array_append(v_missing, 'tournament_match_live');
  END IF;

  IF to_regprocedure('public.canonical_ensure_internal_referee_match_live(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'canonical_ensure_internal_referee_match_live(text)');
  END IF;

  IF to_regprocedure('public.canonical_tournament_update(text,text,uuid,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'canonical_tournament_update(text,text,uuid,jsonb)');
  END IF;

  IF to_regprocedure('public.canonical_commit_internal_referee_match_result(text,integer,integer,bigint)') IS NOT NULL THEN
    RAISE NOTICE 'PRECHECK_NOTE: canonical_commit_internal_referee_match_result already present (APPLY is idempotent REPLACE).';
  ELSE
    RAISE NOTICE 'PRECHECK_OK: canonical_commit_internal_referee_match_result absent (expected before first APPLY).';
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: missing dependencies: %', array_to_string(v_missing, ', ');
  END IF;

  RAISE NOTICE 'PRECHECK_OK: IT-E2E-BROWSER-017 referee canonical commit prerequisites present';
END $$;
