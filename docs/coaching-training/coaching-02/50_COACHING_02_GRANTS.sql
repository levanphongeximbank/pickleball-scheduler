-- =============================================================================
-- COACHING-02 — Least-privilege grants (fail-closed)
-- Status: AUTHORED ONLY — do not apply in COACHING-02.
--
-- Remediation: no broad all-table INSERT/UPDATE for authenticated.
-- Atomic mutations (attendance correction, entitlement consume) are RPC-only.
-- Append-only history tables: SELECT only for authenticated.
-- service_role keeps table ownership for migrations; RPC EXECUTE deferred
-- until trusted-server actor contract exists (COACHING-03).
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- Revoke broad privileges first
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'coaching_programs',
    'coaching_coach_references',
    'coaching_coach_player_relationships',
    'coaching_enrollments',
    'coaching_curricula',
    'coaching_lessons',
    'coaching_training_sessions',
    'coaching_attendance_records',
    'coaching_attendance_corrections',
    'coaching_packages',
    'coaching_package_entitlements',
    'coaching_package_usage_events',
    'coaching_evaluations'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- SELECT for authenticated (RLS still requires coaching.records.read)
-- -----------------------------------------------------------------------------
GRANT SELECT ON TABLE public.coaching_programs TO authenticated;
GRANT SELECT ON TABLE public.coaching_coach_references TO authenticated;
GRANT SELECT ON TABLE public.coaching_coach_player_relationships TO authenticated;
GRANT SELECT ON TABLE public.coaching_enrollments TO authenticated;
GRANT SELECT ON TABLE public.coaching_curricula TO authenticated;
GRANT SELECT ON TABLE public.coaching_lessons TO authenticated;
GRANT SELECT ON TABLE public.coaching_training_sessions TO authenticated;
GRANT SELECT ON TABLE public.coaching_attendance_records TO authenticated;
GRANT SELECT ON TABLE public.coaching_attendance_corrections TO authenticated;
GRANT SELECT ON TABLE public.coaching_packages TO authenticated;
GRANT SELECT ON TABLE public.coaching_package_entitlements TO authenticated;
GRANT SELECT ON TABLE public.coaching_package_usage_events TO authenticated;
GRANT SELECT ON TABLE public.coaching_evaluations TO authenticated;

-- -----------------------------------------------------------------------------
-- INSERT for non-atomic create paths (RLS action-gated)
-- -----------------------------------------------------------------------------
GRANT INSERT ON TABLE public.coaching_programs TO authenticated;
GRANT INSERT ON TABLE public.coaching_coach_references TO authenticated;
GRANT INSERT ON TABLE public.coaching_coach_player_relationships TO authenticated;
GRANT INSERT ON TABLE public.coaching_enrollments TO authenticated;
GRANT INSERT ON TABLE public.coaching_curricula TO authenticated;
GRANT INSERT ON TABLE public.coaching_lessons TO authenticated;
GRANT INSERT ON TABLE public.coaching_training_sessions TO authenticated;
GRANT INSERT ON TABLE public.coaching_attendance_records TO authenticated;
GRANT INSERT ON TABLE public.coaching_packages TO authenticated;
GRANT INSERT ON TABLE public.coaching_package_entitlements TO authenticated;
GRANT INSERT ON TABLE public.coaching_evaluations TO authenticated;

-- NO INSERT for authenticated on:
--   coaching_attendance_corrections  (RPC-only)
--   coaching_package_usage_events    (RPC-only)

-- -----------------------------------------------------------------------------
-- UPDATE for non-atomic lifecycle paths (RLS action-gated)
-- -----------------------------------------------------------------------------
GRANT UPDATE ON TABLE public.coaching_programs TO authenticated;
GRANT UPDATE ON TABLE public.coaching_coach_references TO authenticated;
GRANT UPDATE ON TABLE public.coaching_coach_player_relationships TO authenticated;
GRANT UPDATE ON TABLE public.coaching_enrollments TO authenticated;
GRANT UPDATE ON TABLE public.coaching_curricula TO authenticated;
GRANT UPDATE ON TABLE public.coaching_lessons TO authenticated;
GRANT UPDATE ON TABLE public.coaching_training_sessions TO authenticated;
GRANT UPDATE ON TABLE public.coaching_packages TO authenticated;
GRANT UPDATE ON TABLE public.coaching_evaluations TO authenticated;

-- NO UPDATE for authenticated on:
--   coaching_attendance_records      (correction via RPC only; record = INSERT)
--   coaching_package_entitlements    (consume via RPC only; grant = INSERT)
--   coaching_attendance_corrections  (append-only)
--   coaching_package_usage_events    (append-only)

-- Explicit deny surface for atomic tables (documentation + fail-closed)
REVOKE INSERT, UPDATE, DELETE ON TABLE public.coaching_attendance_corrections FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.coaching_package_usage_events FROM authenticated;
REVOKE UPDATE, DELETE ON TABLE public.coaching_attendance_records FROM authenticated;
REVOKE UPDATE, DELETE ON TABLE public.coaching_package_entitlements FROM authenticated;

-- Anon: no DML
REVOKE ALL ON TABLE public.coaching_programs FROM anon;
REVOKE ALL ON TABLE public.coaching_coach_references FROM anon;
REVOKE ALL ON TABLE public.coaching_coach_player_relationships FROM anon;
REVOKE ALL ON TABLE public.coaching_enrollments FROM anon;
REVOKE ALL ON TABLE public.coaching_curricula FROM anon;
REVOKE ALL ON TABLE public.coaching_lessons FROM anon;
REVOKE ALL ON TABLE public.coaching_training_sessions FROM anon;
REVOKE ALL ON TABLE public.coaching_attendance_records FROM anon;
REVOKE ALL ON TABLE public.coaching_attendance_corrections FROM anon;
REVOKE ALL ON TABLE public.coaching_packages FROM anon;
REVOKE ALL ON TABLE public.coaching_package_entitlements FROM anon;
REVOKE ALL ON TABLE public.coaching_package_usage_events FROM anon;
REVOKE ALL ON TABLE public.coaching_evaluations FROM anon;

-- -----------------------------------------------------------------------------
-- RPC EXECUTE — authenticated only (no service_role until trusted actor contract)
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, timestamptz, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, timestamptz, text
) FROM anon;
REVOKE ALL ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, timestamptz, text
) FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, timestamptz, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, timestamptz
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, timestamptz
) FROM anon;
REVOKE ALL ON FUNCTION public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, timestamptz
) FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, timestamptz
) TO authenticated;
