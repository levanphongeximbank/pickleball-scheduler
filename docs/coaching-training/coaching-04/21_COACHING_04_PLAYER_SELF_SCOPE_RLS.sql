-- =============================================================================
-- COACHING-04 — Additive PLAYER self-scope RLS policies (READ-ONLY)
-- Purpose: Allow PLAYER to SELECT only own canonical player_id rows.
-- Status: AUTHORED ONLY — do not apply without COACHING_04_OWNER_GO_APPLY_STAGING.
--
-- Rules:
--   - Additive alongside coaching_02_* and coaching_04_* (coach) policies.
--   - Policy names: coaching_04_player_*
--   - Requires coaching.self.read + PM-ID-01 mapped self + scope.
--   - No PLAYER mutation policies (business contract remains read-only).
--   - No USING (true) / WITH CHECK (true).
--   - No client DELETE.
--   - No auth.uid() = player_id.
--   - No expansion to other players in the same club.
-- =============================================================================

SET search_path = public, pg_temp;

-- Idempotent drop of PLAYER self-scope policies only
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

-- Ensure RLS remains enforced on Coaching tables (idempotent; tables already FORCE in COACHING-02)
ALTER TABLE public.coaching_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_programs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_curricula ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_curricula FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_lessons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_coach_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_coach_references FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_coach_player_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_coach_player_relationships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_enrollments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_training_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_attendance_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_attendance_corrections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_package_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_package_entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_package_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_package_usage_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_evaluations FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- SELECT — coaching.self.read + mapped self only
-- =============================================================================

CREATE POLICY coaching_04_player_enrollments_select ON public.coaching_enrollments
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_self_action('coaching.self.read')
    AND public.coaching_04_player_is_self(player_id)
  );

CREATE POLICY coaching_04_player_attendance_select ON public.coaching_attendance_records
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_self_action('coaching.self.read')
    AND public.coaching_04_player_is_self(player_id)
  );

CREATE POLICY coaching_04_player_entitlements_select ON public.coaching_package_entitlements
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_self_action('coaching.self.read')
    AND public.coaching_04_player_is_self(player_id)
  );

CREATE POLICY coaching_04_player_usage_select ON public.coaching_package_usage_events
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_self_action('coaching.self.read')
    AND public.coaching_04_player_is_self(player_id)
  );

CREATE POLICY coaching_04_player_evaluations_select ON public.coaching_evaluations
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_self_action('coaching.self.read')
    AND public.coaching_04_player_is_self(player_id)
    AND status = 'submitted'
  );

CREATE POLICY coaching_04_player_cpr_select ON public.coaching_coach_player_relationships
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_self_action('coaching.self.read')
    AND public.coaching_04_player_is_self(player_id)
  );

CREATE POLICY coaching_04_player_sessions_select ON public.coaching_training_sessions
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_self_action('coaching.self.read')
    AND public.coaching_04_mapped_player_id() IS NOT NULL
    AND (
      (
        enrollment_id IS NOT NULL
        AND public.coaching_04_player_can_access_enrollment(enrollment_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.coaching_attendance_records a
        WHERE a.session_id = coaching_training_sessions.session_id
          AND public.coaching_02_scope_allows(a.tenant_id, a.club_id)
          AND public.coaching_04_player_is_self(a.player_id)
      )
    )
  );

CREATE POLICY coaching_04_player_acorr_select ON public.coaching_attendance_corrections
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_self_action('coaching.self.read')
    AND EXISTS (
      SELECT 1
      FROM public.coaching_attendance_records a
      WHERE a.attendance_id = coaching_attendance_corrections.attendance_id
        AND public.coaching_02_scope_allows(a.tenant_id, a.club_id)
        AND public.coaching_04_player_is_self(a.player_id)
    )
  );

CREATE POLICY coaching_04_player_packages_select ON public.coaching_packages
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_self_action('coaching.self.read')
    AND public.coaching_04_mapped_player_id() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.coaching_package_entitlements e
        WHERE e.package_id = coaching_packages.package_id
          AND public.coaching_02_scope_allows(e.tenant_id, e.club_id)
          AND public.coaching_04_player_is_self(e.player_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.coaching_enrollments en
        WHERE en.package_id = coaching_packages.package_id
          AND public.coaching_04_player_can_access_enrollment(en.enrollment_id)
      )
    )
  );

CREATE POLICY coaching_04_player_programs_select ON public.coaching_programs
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_self_action('coaching.self.read')
    AND public.coaching_04_mapped_player_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.coaching_enrollments e
      WHERE e.program_id = coaching_programs.program_id
        AND public.coaching_02_scope_allows(e.tenant_id, e.club_id)
        AND public.coaching_04_player_is_self(e.player_id)
    )
  );

CREATE POLICY coaching_04_player_curricula_select ON public.coaching_curricula
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_self_action('coaching.self.read')
    AND public.coaching_04_mapped_player_id() IS NOT NULL
    AND program_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.coaching_enrollments e
      WHERE e.program_id = coaching_curricula.program_id
        AND public.coaching_02_scope_allows(e.tenant_id, e.club_id)
        AND public.coaching_04_player_is_self(e.player_id)
    )
  );

CREATE POLICY coaching_04_player_lessons_select ON public.coaching_lessons
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_self_action('coaching.self.read')
    AND public.coaching_04_mapped_player_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.coaching_curricula c
      JOIN public.coaching_enrollments e
        ON e.program_id = c.program_id
       AND public.coaching_02_scope_allows(e.tenant_id, e.club_id)
       AND public.coaching_04_player_is_self(e.player_id)
      WHERE c.curriculum_id = coaching_lessons.curriculum_id
        AND public.coaching_02_scope_allows(c.tenant_id, c.club_id)
    )
  );

-- Coach references visible only when relationship binds self as player
CREATE POLICY coaching_04_player_coach_references_select ON public.coaching_coach_references
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_self_action('coaching.self.read')
    AND public.coaching_04_mapped_player_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.coaching_coach_player_relationships r
      WHERE r.coach_reference_id = coaching_coach_references.coach_reference_id
        AND public.coaching_02_scope_allows(r.tenant_id, r.club_id)
        AND public.coaching_04_player_is_self(r.player_id)
    )
  );

-- NO PLAYER INSERT / UPDATE / DELETE policies.
-- Mutations remain blocked until a future Owner-approved write contract.
