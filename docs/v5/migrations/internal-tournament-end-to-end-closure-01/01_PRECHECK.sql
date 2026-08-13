-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: internal-tournament-end-to-end-closure-01
-- Workstream: INTERNAL-TOURNAMENT-END-TO-END-CLOSURE-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- STAGING_MUTATIONS=0 in Pass 2.
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_missing text[] := '{}';
BEGIN
  IF to_regclass('public.canonical_tournaments') IS NULL THEN
    v_missing := array_append(v_missing, 'canonical_tournaments');
  END IF;

  IF to_regprocedure('public.canonical_tournament_update(text,text,uuid,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'canonical_tournament_update(text,text,uuid,jsonb)');
  END IF;

  IF to_regprocedure('public.canonical_tournament_create(text,text,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'canonical_tournament_create(text,text,jsonb)');
  END IF;

  IF to_regprocedure('public.canonical_tournament_assert_tenant(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'canonical_tournament_assert_tenant(text)');
  END IF;

  IF to_regprocedure('public.canonical_tournament_assert_permission(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'canonical_tournament_assert_permission(text)');
  END IF;

  -- Warn (do not fail) if a prior incomplete package left helpers mid-state.
  IF to_regprocedure('public.canonical_tournament_assert_internal_completion_eligible(text,text,text,jsonb)') IS NOT NULL THEN
    RAISE NOTICE 'PRECHECK_NOTE: completion eligibility helper already present (APPLY is idempotent REPLACE).';
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: missing dependencies: %', array_to_string(v_missing, ', ');
  END IF;

  RAISE NOTICE 'PRECHECK_OK: internal-tournament-end-to-end-closure-01 prerequisites present';
END $$;

SELECT
  c.column_name,
  c.data_type
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'canonical_tournaments'
  AND c.column_name IN ('version', 'status', 'mode', 'payload', 'updated_at')
ORDER BY c.column_name;

SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'canonical_tournament_update',
    'canonical_tournament_create',
    'canonical_tournament_assert_internal_status_transition'
  )
ORDER BY 1, 2;
