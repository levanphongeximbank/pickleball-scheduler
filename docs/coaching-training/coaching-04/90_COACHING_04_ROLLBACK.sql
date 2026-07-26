-- =============================================================================
-- COACHING-04 — Rollback
-- Purpose: Drop ONLY coaching_04_* policies, helpers, RPCs, and COACHING-04
--          permission seeds + role_permissions (COACH assigned.* + PLAYER self.read).
-- Status: AUTHORED ONLY — Owner-authorized manual run. Not auto-executed.
-- Does NOT drop coaching_02 / PM-ID-01 objects, tables, data, or admin grants.
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 1. Drop scoped RPCs
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.coaching_04_record_assigned_attendance(
  text, text, text, text, text, text, text, text, text
);
DROP FUNCTION IF EXISTS public.coaching_04_submit_assigned_evaluation(
  text, text, text, text, text, text, text, numeric, text, text, text, integer
);
DROP FUNCTION IF EXISTS public.coaching_04_consume_assigned_entitlement(
  text, text, text, integer, text, text, text, timestamptz
);

-- -----------------------------------------------------------------------------
-- 2. Drop additive PLAYER self-scope policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS coaching_04_player_programs_select ON public.coaching_programs;
DROP POLICY IF EXISTS coaching_04_player_curricula_select ON public.coaching_curricula;
DROP POLICY IF EXISTS coaching_04_player_lessons_select ON public.coaching_lessons;
DROP POLICY IF EXISTS coaching_04_player_packages_select ON public.coaching_packages;
DROP POLICY IF EXISTS coaching_04_player_cpr_select ON public.coaching_coach_player_relationships;
DROP POLICY IF EXISTS coaching_04_player_enrollments_select ON public.coaching_enrollments;
DROP POLICY IF EXISTS coaching_04_player_sessions_select ON public.coaching_training_sessions;
DROP POLICY IF EXISTS coaching_04_player_attendance_select ON public.coaching_attendance_records;
DROP POLICY IF EXISTS coaching_04_player_acorr_select ON public.coaching_attendance_corrections;
DROP POLICY IF EXISTS coaching_04_player_entitlements_select ON public.coaching_package_entitlements;
DROP POLICY IF EXISTS coaching_04_player_usage_select ON public.coaching_package_usage_events;
DROP POLICY IF EXISTS coaching_04_player_evaluations_select ON public.coaching_evaluations;
DROP POLICY IF EXISTS coaching_04_player_coach_references_select ON public.coaching_coach_references;

-- -----------------------------------------------------------------------------
-- 3. Drop additive COACH assignment policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS coaching_04_programs_select ON public.coaching_programs;
DROP POLICY IF EXISTS coaching_04_curricula_select ON public.coaching_curricula;
DROP POLICY IF EXISTS coaching_04_lessons_select ON public.coaching_lessons;
DROP POLICY IF EXISTS coaching_04_packages_select ON public.coaching_packages;
DROP POLICY IF EXISTS coaching_04_coach_references_select ON public.coaching_coach_references;
DROP POLICY IF EXISTS coaching_04_cpr_select ON public.coaching_coach_player_relationships;
DROP POLICY IF EXISTS coaching_04_enrollments_select ON public.coaching_enrollments;
DROP POLICY IF EXISTS coaching_04_sessions_select ON public.coaching_training_sessions;
DROP POLICY IF EXISTS coaching_04_sessions_insert ON public.coaching_training_sessions;
DROP POLICY IF EXISTS coaching_04_sessions_update ON public.coaching_training_sessions;
DROP POLICY IF EXISTS coaching_04_attendance_select ON public.coaching_attendance_records;
DROP POLICY IF EXISTS coaching_04_attendance_insert ON public.coaching_attendance_records;
DROP POLICY IF EXISTS coaching_04_acorr_select ON public.coaching_attendance_corrections;
DROP POLICY IF EXISTS coaching_04_entitlements_select ON public.coaching_package_entitlements;
DROP POLICY IF EXISTS coaching_04_usage_select ON public.coaching_package_usage_events;
DROP POLICY IF EXISTS coaching_04_evaluations_select ON public.coaching_evaluations;
DROP POLICY IF EXISTS coaching_04_evaluations_insert ON public.coaching_evaluations;
DROP POLICY IF EXISTS coaching_04_evaluations_update ON public.coaching_evaluations;

-- -----------------------------------------------------------------------------
-- 4. Drop PLAYER self-scope helpers (order: dependents first)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.coaching_04_player_can_access_enrollment(text);
DROP FUNCTION IF EXISTS public.coaching_04_has_self_action(text);
DROP FUNCTION IF EXISTS public.coaching_04_player_is_self(text);
DROP FUNCTION IF EXISTS public.coaching_04_player_identity_is_mapped();
DROP FUNCTION IF EXISTS public.coaching_04_mapped_player_id();

-- -----------------------------------------------------------------------------
-- 5. Drop COACH assignment helpers
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.coaching_04_has_assigned_action(text);
DROP FUNCTION IF EXISTS public.coaching_04_coach_can_access_program(text);
DROP FUNCTION IF EXISTS public.coaching_04_coach_can_access_enrollment(text);
DROP FUNCTION IF EXISTS public.coaching_04_coach_owns_session(text);
DROP FUNCTION IF EXISTS public.coaching_04_coach_assigned_to_player(text, text);
DROP FUNCTION IF EXISTS public.coaching_04_active_coach_reference_id();
DROP FUNCTION IF EXISTS public.coaching_04_actor_uid();

-- -----------------------------------------------------------------------------
-- 6. Remove COACHING-04 permission grants (COACH assigned.* + PLAYER self.read)
-- -----------------------------------------------------------------------------
DELETE FROM public.role_permissions
WHERE role_id = 'COACH'
  AND permission_id IN (
    'coaching.assigned.read',
    'coaching.assigned.session.schedule',
    'coaching.assigned.attendance.record',
    'coaching.assigned.evaluation.submit',
    'coaching.assigned.entitlement.consume'
  );

DELETE FROM public.role_permissions
WHERE role_id = 'PLAYER'
  AND permission_id = 'coaching.self.read';

-- -----------------------------------------------------------------------------
-- 7. Delete ONLY COACHING-04 permission catalog seeds
-- -----------------------------------------------------------------------------
DELETE FROM public.permissions
WHERE id IN (
  'coaching.assigned.read',
  'coaching.assigned.session.schedule',
  'coaching.assigned.attendance.record',
  'coaching.assigned.evaluation.submit',
  'coaching.assigned.entitlement.consume',
  'coaching.self.read'
);

-- COACHING-02 tables/policies/helpers/RPCs, PM-ID-01 objects, and data remain intact.
-- This file is NEVER auto-executed by apply scripts.
