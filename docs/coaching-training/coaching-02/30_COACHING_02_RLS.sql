-- =============================================================================
-- COACHING-02 — RLS enablement and fail-closed policies
-- Purpose: Tenant/club-scoped RLS for Coaching tables using ONLY verified
--          PICK_VN helpers: auth.uid(), public.user_venue_id(),
--          public.user_club_id(), public.user_has_permission(text),
--          public.is_super_admin().
-- Status: AUTHORED ONLY — do not apply in COACHING-02.
--
-- Architecture note (Sprint-2 identity):
--   JWT venue binding: profiles.venue_id via user_venue_id().
--   JWT club binding: profiles.club_id via user_club_id().
--   No verified dual-scope user_tenant_id() distinct from venue exists.
--   Therefore policies require:
--     tenant_id = user_venue_id()
--     club_id = user_club_id()
--   Rows where tenant_id <> user_venue_id() or club_id <> user_club_id()
--   cannot be accessed via JWT. Fail-closed, not permissive.
--
-- Fail-closed:
--   no actor (auth.uid null) → deny
--   no venue/club binding → deny
--   missing permission → deny
--   cross-tenant / cross-club → deny
--   unknown action → deny (no blanket authenticated access)
--
-- No USING (true). No WITH CHECK (true). No anon policies.
-- No PUBLIC write. Append-only tables: SELECT + INSERT only.
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- Scope helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_02_scope_allows(
  p_tenant_id text,
  p_club_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND public.user_venue_id() IS NOT NULL
    AND public.user_club_id() IS NOT NULL
    AND length(trim(coalesce(p_tenant_id, ''))) > 0
    AND length(trim(coalesce(p_club_id, ''))) > 0
    AND p_tenant_id = public.user_venue_id()
    AND p_club_id = public.user_club_id();
$$;

COMMENT ON FUNCTION public.coaching_02_scope_allows(text, text) IS
  'COACHING-02 fail-closed scope gate. Requires authenticated caller with non-null user_venue_id matching tenant_id and user_club_id matching club_id.';

REVOKE ALL ON FUNCTION public.coaching_02_scope_allows(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coaching_02_scope_allows(text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Action helper — maps to Identity permission ids (14 COACHING-01 actions)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_02_has_action(p_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      public.is_super_admin()
      OR public.user_has_permission(p_action)
    );
$$;

COMMENT ON FUNCTION public.coaching_02_has_action(text) IS
  'COACHING-02 action gate via user_has_permission / is_super_admin. Unknown action strings deny.';

REVOKE ALL ON FUNCTION public.coaching_02_has_action(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coaching_02_has_action(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Enable + FORCE RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.coaching_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_coach_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_coach_player_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_curricula ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_package_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_package_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_evaluations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.coaching_programs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_coach_references FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_coach_player_relationships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_enrollments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_curricula FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_lessons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_training_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_attendance_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_attendance_corrections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_package_entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_package_usage_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_evaluations FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Drop prior COACHING-02 policies (idempotent re-author)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- coaching_programs
-- -----------------------------------------------------------------------------
CREATE POLICY coaching_programs_select ON public.coaching_programs
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.records.read')
  );

CREATE POLICY coaching_programs_insert ON public.coaching_programs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.program.create')
  );

CREATE POLICY coaching_programs_update ON public.coaching_programs
  FOR UPDATE TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.program.update')
  )
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.program.update')
  );

-- -----------------------------------------------------------------------------
-- coaching_coach_references
-- -----------------------------------------------------------------------------
CREATE POLICY coaching_coach_references_select ON public.coaching_coach_references
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.records.read')
  );

CREATE POLICY coaching_coach_references_insert ON public.coaching_coach_references
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.coach.assign')
  );

CREATE POLICY coaching_coach_references_update ON public.coaching_coach_references
  FOR UPDATE TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.coach.assign')
  )
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.coach.assign')
  );

-- -----------------------------------------------------------------------------
-- coaching_coach_player_relationships
-- -----------------------------------------------------------------------------
CREATE POLICY coaching_cpr_select ON public.coaching_coach_player_relationships
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.records.read')
  );

CREATE POLICY coaching_cpr_insert ON public.coaching_coach_player_relationships
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.coach.assign')
  );

CREATE POLICY coaching_cpr_update ON public.coaching_coach_player_relationships
  FOR UPDATE TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.coach.assign')
  )
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.coach.assign')
  );

-- -----------------------------------------------------------------------------
-- coaching_enrollments
-- -----------------------------------------------------------------------------
CREATE POLICY coaching_enrollments_select ON public.coaching_enrollments
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.records.read')
  );

CREATE POLICY coaching_enrollments_insert ON public.coaching_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.player.enroll')
  );

CREATE POLICY coaching_enrollments_update ON public.coaching_enrollments
  FOR UPDATE TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.player.enroll')
  )
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.player.enroll')
  );

-- -----------------------------------------------------------------------------
-- coaching_curricula
-- -----------------------------------------------------------------------------
CREATE POLICY coaching_curricula_select ON public.coaching_curricula
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.records.read')
  );

CREATE POLICY coaching_curricula_insert ON public.coaching_curricula
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.curriculum.create')
  );

CREATE POLICY coaching_curricula_update ON public.coaching_curricula
  FOR UPDATE TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.curriculum.create')
  )
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.curriculum.create')
  );

-- -----------------------------------------------------------------------------
-- coaching_lessons
-- -----------------------------------------------------------------------------
CREATE POLICY coaching_lessons_select ON public.coaching_lessons
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.records.read')
  );

CREATE POLICY coaching_lessons_insert ON public.coaching_lessons
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.lesson.create')
  );

CREATE POLICY coaching_lessons_update ON public.coaching_lessons
  FOR UPDATE TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.lesson.create')
  )
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.lesson.create')
  );

-- -----------------------------------------------------------------------------
-- coaching_training_sessions
-- -----------------------------------------------------------------------------
CREATE POLICY coaching_sessions_select ON public.coaching_training_sessions
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.records.read')
  );

CREATE POLICY coaching_sessions_insert ON public.coaching_training_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.session.schedule')
  );

CREATE POLICY coaching_sessions_update ON public.coaching_training_sessions
  FOR UPDATE TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.session.schedule')
  )
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.session.schedule')
  );

-- -----------------------------------------------------------------------------
-- coaching_attendance_records
-- -----------------------------------------------------------------------------
CREATE POLICY coaching_attendance_select ON public.coaching_attendance_records
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.records.read')
  );

CREATE POLICY coaching_attendance_insert ON public.coaching_attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.attendance.record')
  );

CREATE POLICY coaching_attendance_update ON public.coaching_attendance_records
  FOR UPDATE TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.attendance.correct')
  )
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.attendance.correct')
  );

-- -----------------------------------------------------------------------------
-- coaching_attendance_corrections — APPEND-ONLY (no UPDATE/DELETE policies)
-- -----------------------------------------------------------------------------
CREATE POLICY coaching_acorr_select ON public.coaching_attendance_corrections
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.records.read')
  );

CREATE POLICY coaching_acorr_insert ON public.coaching_attendance_corrections
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.attendance.correct')
  );

-- -----------------------------------------------------------------------------
-- coaching_packages
-- -----------------------------------------------------------------------------
CREATE POLICY coaching_packages_select ON public.coaching_packages
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.records.read')
  );

CREATE POLICY coaching_packages_insert ON public.coaching_packages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.package.create')
  );

CREATE POLICY coaching_packages_update ON public.coaching_packages
  FOR UPDATE TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.package.create')
  )
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.package.create')
  );

-- -----------------------------------------------------------------------------
-- coaching_package_entitlements
-- -----------------------------------------------------------------------------
CREATE POLICY coaching_entitlements_select ON public.coaching_package_entitlements
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.records.read')
  );

CREATE POLICY coaching_entitlements_insert ON public.coaching_package_entitlements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.entitlement.grant')
  );

CREATE POLICY coaching_entitlements_update ON public.coaching_package_entitlements
  FOR UPDATE TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND (
      public.coaching_02_has_action('coaching.entitlement.grant')
      OR public.coaching_02_has_action('coaching.entitlement.consume')
    )
  )
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND (
      public.coaching_02_has_action('coaching.entitlement.grant')
      OR public.coaching_02_has_action('coaching.entitlement.consume')
    )
  );

-- -----------------------------------------------------------------------------
-- coaching_package_usage_events — APPEND-ONLY (no UPDATE/DELETE policies)
-- -----------------------------------------------------------------------------
CREATE POLICY coaching_usage_select ON public.coaching_package_usage_events
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.records.read')
  );

CREATE POLICY coaching_usage_insert ON public.coaching_package_usage_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.entitlement.consume')
  );

-- -----------------------------------------------------------------------------
-- coaching_evaluations
-- -----------------------------------------------------------------------------
CREATE POLICY coaching_evaluations_select ON public.coaching_evaluations
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.records.read')
  );

CREATE POLICY coaching_evaluations_insert ON public.coaching_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.evaluation.submit')
  );

CREATE POLICY coaching_evaluations_update ON public.coaching_evaluations
  FOR UPDATE TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.evaluation.submit')
    AND status = 'draft'
  )
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_02_has_action('coaching.evaluation.submit')
  );
