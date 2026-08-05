-- RATING-V5-CUTOVER-02 Gate A3d-Security — Least-privilege grant reconciliation
-- AUTHOR ONLY — DO NOT APPLY in this gate (A3D_SECURITY_SQL_APPLY_GO=NO / SQL_EXECUTION=0).
--
-- Purpose:
--   Remove authenticated EXECUTE grants that Supabase public-schema default
--   privileges attached at CREATE FUNCTION time for A3c RPCs.
--   Original migration revoked PUBLIC only and granted service_role on the two
--   service RPCs; it did not REVOKE authenticated.
--
-- Live pre-corrective ACL snapshot (Staging qyewbxjsiiyufanzcjcq, Gate A3d):
--   All four A3c functions:
--     owner=postgres, security definer=true
--     PUBLIC execute=false, anon execute=false
--     authenticated execute=true, service_role execute=true
--     ACL text: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--
-- Target ACL (all four):
--     REVOKE EXECUTE FROM PUBLIC, anon, authenticated
--     GRANT EXECUTE TO service_role only
--
-- Safety:
--   - Exact Staging project guard: qyewbxjsiiyufanzcjcq
--   - Explicit Production deny: expuvcohlcjzvrrauvud
--   - No table/data/cohort/rollout/writer-freeze mutation
--   - No ALTER DEFAULT PRIVILEGES
--   - Idempotent REVOKE/GRANT
--
-- Expected migration identity:
--   rating_v5_cutover_02_a3d_least_privilege_grants_v1
--
-- Does NOT weaken rating_v5_assert_service_role or A3c internal caller guards.

BEGIN;

DO $$
DECLARE
  v_db_ref text := coalesce(
    current_setting('app.settings.supabase_project_ref', true),
    current_setting('app.supabase_project_ref', true),
    ''
  );
  v_env text := lower(coalesce(current_setting('app.settings.app_env', true), ''));
BEGIN
  IF v_db_ref = 'expuvcohlcjzvrrauvud' OR v_env IN ('production', 'prod') THEN
    RAISE EXCEPTION 'CUTOVER_02_A3D_SEC_REFUSE_PRODUCTION: least-privilege SQL must not apply on Production';
  END IF;

  IF v_db_ref <> '' AND v_db_ref <> 'qyewbxjsiiyufanzcjcq' THEN
    RAISE EXCEPTION 'CUTOVER_02_A3D_SEC_REFUSE_UNKNOWN_REF: expected staging ref qyewbxjsiiyufanzcjcq, got %', v_db_ref;
  END IF;
END $$;

-- Require the four A3c objects from rating_v5_cutover_02_a3c_fixture_prep_v1
DO $$
BEGIN
  IF to_regprocedure('public.rating_v5_cutover_02_a3c_assert_staging_project()') IS NULL
     OR to_regprocedure('public.rating_v5_cutover_02_a3c_assert_caller(uuid)') IS NULL
     OR to_regprocedure('public.rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid,uuid,text,text,text)') IS NULL
     OR to_regprocedure('public.rating_v5_cutover_02_a3c_service_record_prep_audit(uuid,jsonb)') IS NULL
  THEN
    RAISE EXCEPTION 'CUTOVER_02_A3D_SEC_MISSING_A3C_OBJECTS: apply A3c fixture prep migration first';
  END IF;
END $$;

-- ── Assert helpers (internal to service path; Edge does not call directly) ──
REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_assert_staging_project() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_assert_staging_project() FROM anon;
REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_assert_staging_project() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rating_v5_cutover_02_a3c_assert_staging_project() TO service_role;

REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_assert_caller(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_assert_caller(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_assert_caller(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rating_v5_cutover_02_a3c_assert_caller(uuid) TO service_role;

-- ── Service RPCs (Edge service_role client only) ──
REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid, uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid, uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid, uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_service_record_prep_audit(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_service_record_prep_audit(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_service_record_prep_audit(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rating_v5_cutover_02_a3c_service_record_prep_audit(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid, uuid, text, text, text) IS
  'CUTOVER-02 A3c Staging-only service RPC. EXECUTE: service_role only (A3d-Security).';

COMMENT ON FUNCTION public.rating_v5_cutover_02_a3c_service_record_prep_audit(uuid, jsonb) IS
  'CUTOVER-02 A3c Staging-only prep audit RPC. EXECUTE: service_role only (A3d-Security).';

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICATION (read-only; run after Owner apply GO — not this gate)
-- ---------------------------------------------------------------------------
-- SELECT p.proname,
--   has_function_privilege('public', p.oid, 'execute') AS public_exec,
--   has_function_privilege('anon', p.oid, 'execute') AS anon_exec,
--   has_function_privilege('authenticated', p.oid, 'execute') AS auth_exec,
--   has_function_privilege('service_role', p.oid, 'execute') AS service_exec
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname LIKE 'rating_v5_cutover_02_a3c%'
-- ORDER BY 1;
-- Expected: public_exec=false, anon_exec=false, auth_exec=false, service_exec=true

-- ---------------------------------------------------------------------------
-- DOWN / ROLLBACK — restore ONLY documented pre-corrective grants from live snapshot
-- (PUBLIC/anon remain revoked; restore authenticated EXECUTE; keep service_role)
-- ---------------------------------------------------------------------------
-- BEGIN;
-- DO $$
-- DECLARE
--   v_db_ref text := coalesce(
--     current_setting('app.settings.supabase_project_ref', true),
--     current_setting('app.supabase_project_ref', true),
--     ''
--   );
-- BEGIN
--   IF v_db_ref = 'expuvcohlcjzvrrauvud' THEN
--     RAISE EXCEPTION 'CUTOVER_02_A3D_SEC_ROLLBACK_REFUSE_PRODUCTION';
--   END IF;
-- END $$;
-- GRANT EXECUTE ON FUNCTION public.rating_v5_cutover_02_a3c_assert_staging_project() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.rating_v5_cutover_02_a3c_assert_staging_project() TO service_role;
-- GRANT EXECUTE ON FUNCTION public.rating_v5_cutover_02_a3c_assert_caller(uuid) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.rating_v5_cutover_02_a3c_assert_caller(uuid) TO service_role;
-- GRANT EXECUTE ON FUNCTION public.rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid, uuid, text, text, text) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid, uuid, text, text, text) TO service_role;
-- GRANT EXECUTE ON FUNCTION public.rating_v5_cutover_02_a3c_service_record_prep_audit(uuid, jsonb) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.rating_v5_cutover_02_a3c_service_record_prep_audit(uuid, jsonb) TO service_role;
-- REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_assert_staging_project() FROM PUBLIC;
-- REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_assert_staging_project() FROM anon;
-- REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_assert_caller(uuid) FROM PUBLIC;
-- REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_assert_caller(uuid) FROM anon;
-- REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid, uuid, text, text, text) FROM PUBLIC;
-- REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid, uuid, text, text, text) FROM anon;
-- REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_service_record_prep_audit(uuid, jsonb) FROM PUBLIC;
-- REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_service_record_prep_audit(uuid, jsonb) FROM anon;
-- COMMIT;
