-- ═══════════════════════════════════════════════════════════════════
-- 05_STAGING_SQL_ACCEPTANCE.sql
-- Package: core13-canonical-assignment-runtime-closure-01
--
-- STAGING_SQL_ACCEPTANCE_TEST_NOT_RUN_REQUIRES_OWNER_GO=YES
-- SQL_EXECUTION_GO=NO · STAGING_MUTATION_GO=NO · EDGE_FUNCTION_DEPLOY_GO=NO
--
-- This file is intentionally fail-closed. Catalog-only SQL cannot exercise:
--   Edge Function JWT auth, actor provenance, CORE-13 rejection, or
--   authenticated direct-RPC denial against a live endpoint.
--
-- Executable harness (do NOT run now):
--   scripts/core13/core13-trusted-server-staging-acceptance.mjs
-- Requires explicit non-production flags; refuses Production URLs.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  raise exception
    'STAGING_SQL_ACCEPTANCE_TEST_NOT_RUN_REQUIRES_OWNER_GO — refuse until Owner GO; use scripts/core13/core13-trusted-server-staging-acceptance.mjs';
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- Later Owner GO — catalog probes (also covered by 03_VERIFY.sql)
-- ─────────────────────────────────────────────────────────────────
-- Confirm:
--   * anon/public/authenticated cannot EXECUTE competition_assign/replace/unassign_referee
--   * service_role CAN EXECUTE those three RPCs
--   * helpers including competition_assignment_assert_mutation_boundary
--     are NOT executable by anon/authenticated/public
--   * authenticated has NO SELECT on competition_referee_assignment_audit
--   * authenticated has NO SELECT on competition_referee_assignment_idempotency
--   * SECURITY DEFINER + search_path=public on mutation RPCs + boundary helper
--   * pg_get_functiondef contains:
--       SERVICE_ROLE_REQUIRED
--       ORIGINATING_ACTOR_REQUIRED
--       CROSS_TOURNAMENT_DENIED
--       LIFECYCLE_DENIED
--     and does NOT contain v_actor := auth.uid()
--     and does NOT contain coalesce(p_actor_id, auth.uid())
--   * CAS objects: expected_version + STALE_WRITE
--   * unique index competition_referee_assignments_active_match_role_uq
--   * RLS enabled on audit + idempotency
--
-- Re-run 03_VERIFY.sql for the automated catalog assertions.
--
-- Mutation / Edge / actor / CORE-13 probes live in the JS harness, not here.
