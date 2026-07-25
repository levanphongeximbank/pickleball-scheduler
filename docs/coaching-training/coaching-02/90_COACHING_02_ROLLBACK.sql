-- =============================================================================
-- COACHING-02 — Rollback / down strategy
-- Purpose: Reverse COACHING-02 objects in safe dependency order.
-- Status: AUTHORED ONLY — Owner-authorized manual run. Not auto-executed.
-- Does NOT drop shared Platform / Identity helpers (user_has_permission,
-- user_venue_id, user_club_id, is_super_admin, permissions catalog rows).
-- Does NOT touch Phase 28 prototype tables (separate legacy disposition).
-- =============================================================================

SET search_path = public, pg_temp;

-- 1. Drop RPCs (drops dependent grants)
DROP FUNCTION IF EXISTS public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, text, timestamptz, text
);
DROP FUNCTION IF EXISTS public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, text, timestamptz
);

-- 2. Drop triggers then immutability functions
DROP TRIGGER IF EXISTS coaching_attendance_corrections_immutable_trg
  ON public.coaching_attendance_corrections;
DROP TRIGGER IF EXISTS coaching_package_usage_events_immutable_trg
  ON public.coaching_package_usage_events;
DROP TRIGGER IF EXISTS coaching_evaluations_submitted_immutable_trg
  ON public.coaching_evaluations;

DROP FUNCTION IF EXISTS public.coaching_attendance_corrections_immutable_guard();
DROP FUNCTION IF EXISTS public.coaching_package_usage_events_immutable_guard();
DROP FUNCTION IF EXISTS public.coaching_evaluations_submitted_immutable_guard();

-- 3. Drop policies (tables must exist; IF EXISTS on policy)
DROP POLICY IF EXISTS coaching_programs_select ON public.coaching_programs;
DROP POLICY IF EXISTS coaching_programs_insert ON public.coaching_programs;
DROP POLICY IF EXISTS coaching_programs_update ON public.coaching_programs;
DROP POLICY IF EXISTS coaching_coach_references_select ON public.coaching_coach_references;
DROP POLICY IF EXISTS coaching_coach_references_insert ON public.coaching_coach_references;
DROP POLICY IF EXISTS coaching_coach_references_update ON public.coaching_coach_references;
DROP POLICY IF EXISTS coaching_cpr_select ON public.coaching_coach_player_relationships;
DROP POLICY IF EXISTS coaching_cpr_insert ON public.coaching_coach_player_relationships;
DROP POLICY IF EXISTS coaching_cpr_update ON public.coaching_coach_player_relationships;
DROP POLICY IF EXISTS coaching_enrollments_select ON public.coaching_enrollments;
DROP POLICY IF EXISTS coaching_enrollments_insert ON public.coaching_enrollments;
DROP POLICY IF EXISTS coaching_enrollments_update ON public.coaching_enrollments;
DROP POLICY IF EXISTS coaching_curricula_select ON public.coaching_curricula;
DROP POLICY IF EXISTS coaching_curricula_insert ON public.coaching_curricula;
DROP POLICY IF EXISTS coaching_curricula_update ON public.coaching_curricula;
DROP POLICY IF EXISTS coaching_lessons_select ON public.coaching_lessons;
DROP POLICY IF EXISTS coaching_lessons_insert ON public.coaching_lessons;
DROP POLICY IF EXISTS coaching_lessons_update ON public.coaching_lessons;
DROP POLICY IF EXISTS coaching_sessions_select ON public.coaching_training_sessions;
DROP POLICY IF EXISTS coaching_sessions_insert ON public.coaching_training_sessions;
DROP POLICY IF EXISTS coaching_sessions_update ON public.coaching_training_sessions;
DROP POLICY IF EXISTS coaching_attendance_select ON public.coaching_attendance_records;
DROP POLICY IF EXISTS coaching_attendance_insert ON public.coaching_attendance_records;
DROP POLICY IF EXISTS coaching_attendance_update ON public.coaching_attendance_records;
DROP POLICY IF EXISTS coaching_acorr_select ON public.coaching_attendance_corrections;
DROP POLICY IF EXISTS coaching_acorr_insert ON public.coaching_attendance_corrections;
DROP POLICY IF EXISTS coaching_packages_select ON public.coaching_packages;
DROP POLICY IF EXISTS coaching_packages_insert ON public.coaching_packages;
DROP POLICY IF EXISTS coaching_packages_update ON public.coaching_packages;
DROP POLICY IF EXISTS coaching_entitlements_select ON public.coaching_package_entitlements;
DROP POLICY IF EXISTS coaching_entitlements_insert ON public.coaching_package_entitlements;
DROP POLICY IF EXISTS coaching_entitlements_update ON public.coaching_package_entitlements;
DROP POLICY IF EXISTS coaching_usage_select ON public.coaching_package_usage_events;
DROP POLICY IF EXISTS coaching_usage_insert ON public.coaching_package_usage_events;
DROP POLICY IF EXISTS coaching_evaluations_select ON public.coaching_evaluations;
DROP POLICY IF EXISTS coaching_evaluations_insert ON public.coaching_evaluations;
DROP POLICY IF EXISTS coaching_evaluations_update ON public.coaching_evaluations;

-- 4. Drop scope helpers
DROP FUNCTION IF EXISTS public.coaching_02_has_action(text);
DROP FUNCTION IF EXISTS public.coaching_02_scope_allows(text, text);

-- 5. Drop indexes (cascade with tables, but explicit for clarity)
DROP INDEX IF EXISTS public.coaching_programs_tenant_club_idx;
DROP INDEX IF EXISTS public.coaching_programs_tenant_club_status_idx;
DROP INDEX IF EXISTS public.coaching_coach_references_tenant_club_idx;
DROP INDEX IF EXISTS public.coaching_cpr_tenant_club_idx;
DROP INDEX IF EXISTS public.coaching_cpr_tenant_club_player_idx;
DROP INDEX IF EXISTS public.coaching_enrollments_tenant_club_idx;
DROP INDEX IF EXISTS public.coaching_enrollments_tenant_club_program_idx;
DROP INDEX IF EXISTS public.coaching_curricula_tenant_club_idx;
DROP INDEX IF EXISTS public.coaching_lessons_tenant_club_curriculum_idx;
DROP INDEX IF EXISTS public.coaching_sessions_tenant_club_idx;
DROP INDEX IF EXISTS public.coaching_sessions_tenant_club_starts_idx;
DROP INDEX IF EXISTS public.coaching_attendance_tenant_club_idx;
DROP INDEX IF EXISTS public.coaching_attendance_tenant_club_session_idx;
DROP INDEX IF EXISTS public.coaching_acorr_tenant_club_attendance_idx;
DROP INDEX IF EXISTS public.coaching_packages_tenant_club_idx;
DROP INDEX IF EXISTS public.coaching_entitlements_tenant_club_idx;
DROP INDEX IF EXISTS public.coaching_entitlements_tenant_club_player_idx;
DROP INDEX IF EXISTS public.coaching_usage_tenant_club_entitlement_idx;
DROP INDEX IF EXISTS public.coaching_evaluations_tenant_club_idx;
DROP INDEX IF EXISTS public.coaching_evaluations_tenant_club_player_idx;

-- 6. Drop tables (children / history first)
DROP TABLE IF EXISTS public.coaching_package_usage_events;
DROP TABLE IF EXISTS public.coaching_attendance_corrections;
DROP TABLE IF EXISTS public.coaching_evaluations;
DROP TABLE IF EXISTS public.coaching_attendance_records;
DROP TABLE IF EXISTS public.coaching_package_entitlements;
DROP TABLE IF EXISTS public.coaching_packages;
DROP TABLE IF EXISTS public.coaching_training_sessions;
DROP TABLE IF EXISTS public.coaching_lessons;
DROP TABLE IF EXISTS public.coaching_curricula;
DROP TABLE IF EXISTS public.coaching_enrollments;
DROP TABLE IF EXISTS public.coaching_coach_player_relationships;
DROP TABLE IF EXISTS public.coaching_coach_references;
DROP TABLE IF EXISTS public.coaching_programs;

-- NOTE: Permission catalog rows from 15_COACHING_02_PERMISSION_SEED.sql are
-- intentionally retained (Identity catalog). Owner may delete manually if needed.
-- NOTE: Does not DROP public.permissions or any Identity/Platform shared object.
