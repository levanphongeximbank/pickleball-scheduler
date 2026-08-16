-- ═══════════════════════════════════════════════════════════════════
-- 05_REFEREE_RUNTIME_PRECHECK.sql
-- Package: internal-tournament-end-to-end-closure-01 (additive follow-up)
-- Workstream: IT-E2E-BROWSER-016
-- STAGING ONLY. Do not apply to Production.
--
-- STAGING_PROJECT=qyewbxjsiiyufanzcjcq
-- PRODUCTION_PROJECT=expuvcohlcjzvrrauvud
-- TARGET_IS_STAGING=YES
-- TARGET_IS_PRODUCTION=NO
--
-- Earlier files 01–04 are already live on Staging. This file does not
-- rewrite that history.
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

  IF to_regprocedure('public.referee_get_match_by_token(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'referee_get_match_by_token(text)');
  END IF;

  IF to_regprocedure('public.referee_update_match_score(text,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'referee_update_match_score(text,jsonb)');
  END IF;

  IF to_regprocedure('public.team_tournament_ensure_referee_runtime_for_matchup(team_tournaments,team_tournament_matchups,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'team_tournament_ensure_referee_runtime_for_matchup (Team-specific)');
  END IF;

  IF to_regprocedure('public.canonical_ensure_internal_referee_match_live(text)') IS NOT NULL THEN
    RAISE NOTICE 'PRECHECK_NOTE: canonical_ensure_internal_referee_match_live already present (APPLY is idempotent REPLACE).';
  ELSE
    RAISE NOTICE 'PRECHECK_OK: canonical_ensure_internal_referee_match_live absent (expected before first APPLY).';
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: missing dependencies: %', array_to_string(v_missing, ', ');
  END IF;

  RAISE NOTICE 'PRECHECK_OK: IT-E2E-BROWSER-016 referee runtime prerequisites present';
END $$;

SELECT
  c.conname,
  pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
WHERE c.conrelid = 'public.tournament_match_live'::regclass
ORDER BY c.conname;

SELECT
  i.indexname,
  i.indexdef
FROM pg_indexes i
WHERE i.schemaname = 'public'
  AND i.tablename = 'tournament_match_live'
ORDER BY i.indexname;

SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'referee_get_match_by_token',
    'referee_update_match_score',
    'team_tournament_ensure_referee_runtime_for_matchup',
    'canonical_ensure_internal_referee_match_live'
  )
ORDER BY 1, 2;
