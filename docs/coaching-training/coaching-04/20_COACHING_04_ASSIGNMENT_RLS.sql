-- =============================================================================
-- COACHING-04 — Additive assignment-aware RLS policies
-- Purpose: Grant COACH scoped SELECT/mutate WITHOUT narrowing COACHING-02 admin
--          policies. Postgres ORs policies for the same command.
-- Status: AUTHORED ONLY — do not apply without Owner GO.
--
-- Rules:
--   - Do NOT DROP coaching_02 / coaching_* admin policies from 30_COACHING_02_RLS.sql
--   - Policy names: coaching_04_*
--   - No PLAYER policies (COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED)
--   - No USING (true) / WITH CHECK (true)
--   - No client DELETE policies
--   - No direct UPDATE on entitlements for assigned consume (RPC only)
--   - Do NOT rely on coaching.records.read for COACH (not granted)
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- Idempotent drop of COACHING-04 policies only (safe re-author)
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

-- =============================================================================
-- SELECT — coaching.assigned.read
-- =============================================================================

-- programs
CREATE POLICY coaching_04_programs_select ON public.coaching_programs
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.read')
    AND public.coaching_04_coach_can_access_program(program_id)
  );

-- curricula (program-scoped or any active assignment if program_id null)
CREATE POLICY coaching_04_curricula_select ON public.coaching_curricula
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.read')
    AND public.coaching_04_active_coach_reference_id() IS NOT NULL
    AND (
      (
        program_id IS NOT NULL
        AND public.coaching_04_coach_can_access_program(program_id)
      )
      OR (
        program_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.coaching_coach_player_relationships r
          WHERE r.coach_reference_id = public.coaching_04_active_coach_reference_id()
            AND r.status = 'active'
            AND public.coaching_02_scope_allows(r.tenant_id, r.club_id)
        )
      )
    )
  );

-- lessons via parent curriculum
CREATE POLICY coaching_04_lessons_select ON public.coaching_lessons
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.read')
    AND public.coaching_04_active_coach_reference_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.coaching_curricula c
      WHERE c.curriculum_id = coaching_lessons.curriculum_id
        AND public.coaching_02_scope_allows(c.tenant_id, c.club_id)
        AND (
          (
            c.program_id IS NOT NULL
            AND public.coaching_04_coach_can_access_program(c.program_id)
          )
          OR (
            c.program_id IS NULL
            AND EXISTS (
              SELECT 1
              FROM public.coaching_coach_player_relationships r
              WHERE r.coach_reference_id = public.coaching_04_active_coach_reference_id()
                AND r.status = 'active'
                AND public.coaching_02_scope_allows(r.tenant_id, r.club_id)
            )
          )
        )
    )
  );

-- packages tied to assigned player enrollment or entitlement
CREATE POLICY coaching_04_packages_select ON public.coaching_packages
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.read')
    AND public.coaching_04_active_coach_reference_id() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.coaching_package_entitlements e
        WHERE e.package_id = coaching_packages.package_id
          AND public.coaching_02_scope_allows(e.tenant_id, e.club_id)
          AND public.coaching_04_coach_assigned_to_player(e.player_id, NULL)
      )
      OR EXISTS (
        SELECT 1
        FROM public.coaching_enrollments en
        WHERE en.package_id = coaching_packages.package_id
          AND public.coaching_04_coach_can_access_enrollment(en.enrollment_id)
      )
    )
  );

-- coach_references — own row only (principal match in scope)
CREATE POLICY coaching_04_coach_references_select ON public.coaching_coach_references
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.read')
    AND auth.uid() IS NOT NULL
    AND coach_principal_id = auth.uid()::text
  );

-- relationships — rows for caller's coach_reference (incl. inactive links for audit;
-- other-table helpers still require relationship status = active)
CREATE POLICY coaching_04_cpr_select ON public.coaching_coach_player_relationships
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.read')
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.coaching_coach_references cr
      WHERE cr.coach_reference_id = coaching_coach_player_relationships.coach_reference_id
        AND cr.coach_principal_id = auth.uid()::text
        AND public.coaching_02_scope_allows(cr.tenant_id, cr.club_id)
    )
  );

-- enrollments
CREATE POLICY coaching_04_enrollments_select ON public.coaching_enrollments
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.read')
    AND public.coaching_04_coach_can_access_enrollment(enrollment_id)
  );

-- sessions — owned or linked via assigned enrollment/attendance
CREATE POLICY coaching_04_sessions_select ON public.coaching_training_sessions
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.read')
    AND (
      public.coaching_04_coach_owns_session(session_id)
      OR (
        enrollment_id IS NOT NULL
        AND public.coaching_04_coach_can_access_enrollment(enrollment_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.coaching_attendance_records a
        WHERE a.session_id = coaching_training_sessions.session_id
          AND public.coaching_02_scope_allows(a.tenant_id, a.club_id)
          AND public.coaching_04_coach_assigned_to_player(
            a.player_id,
            coaching_training_sessions.program_id
          )
      )
    )
  );

-- attendance
CREATE POLICY coaching_04_attendance_select ON public.coaching_attendance_records
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.read')
    AND public.coaching_04_coach_assigned_to_player(player_id, NULL)
    AND (
      public.coaching_04_coach_owns_session(session_id)
      OR EXISTS (
        SELECT 1
        FROM public.coaching_training_sessions s
        WHERE s.session_id = coaching_attendance_records.session_id
          AND public.coaching_02_scope_allows(s.tenant_id, s.club_id)
          AND s.enrollment_id IS NOT NULL
          AND public.coaching_04_coach_can_access_enrollment(s.enrollment_id)
      )
    )
  );

-- corrections for assigned attendance
CREATE POLICY coaching_04_acorr_select ON public.coaching_attendance_corrections
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.read')
    AND EXISTS (
      SELECT 1
      FROM public.coaching_attendance_records a
      WHERE a.attendance_id = coaching_attendance_corrections.attendance_id
        AND public.coaching_02_scope_allows(a.tenant_id, a.club_id)
        AND public.coaching_04_coach_assigned_to_player(a.player_id, NULL)
        AND public.coaching_04_coach_owns_session(a.session_id)
    )
  );

-- entitlements
CREATE POLICY coaching_04_entitlements_select ON public.coaching_package_entitlements
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.read')
    AND public.coaching_04_coach_assigned_to_player(player_id, NULL)
  );

-- usage events
CREATE POLICY coaching_04_usage_select ON public.coaching_package_usage_events
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.read')
    AND public.coaching_04_coach_assigned_to_player(player_id, NULL)
  );

-- evaluations
CREATE POLICY coaching_04_evaluations_select ON public.coaching_evaluations
  FOR SELECT TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.read')
    AND public.coaching_04_coach_assigned_to_player(player_id, program_id)
  );

-- =============================================================================
-- MUTATIONS — scoped assigned permissions
-- =============================================================================

-- sessions schedule INSERT (own active coach_reference_id)
CREATE POLICY coaching_04_sessions_insert ON public.coaching_training_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.session.schedule')
    AND public.coaching_04_active_coach_reference_id() IS NOT NULL
    AND coach_reference_id = public.coaching_04_active_coach_reference_id()
  );

-- sessions schedule UPDATE (must remain own active ref)
CREATE POLICY coaching_04_sessions_update ON public.coaching_training_sessions
  FOR UPDATE TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.session.schedule')
    AND public.coaching_04_active_coach_reference_id() IS NOT NULL
    AND coach_reference_id = public.coaching_04_active_coach_reference_id()
  )
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.session.schedule')
    AND public.coaching_04_active_coach_reference_id() IS NOT NULL
    AND coach_reference_id = public.coaching_04_active_coach_reference_id()
  );

-- attendance INSERT for assigned player + owned session
CREATE POLICY coaching_04_attendance_insert ON public.coaching_attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.attendance.record')
    AND public.coaching_04_coach_owns_session(session_id)
    AND public.coaching_04_coach_assigned_to_player(
      player_id,
      (
        SELECT s.program_id
        FROM public.coaching_training_sessions s
        WHERE s.session_id = coaching_attendance_records.session_id
        LIMIT 1
      )
    )
  );

-- evaluations INSERT for assigned player
CREATE POLICY coaching_04_evaluations_insert ON public.coaching_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.evaluation.submit')
    AND public.coaching_04_active_coach_reference_id() IS NOT NULL
    AND (
      coach_reference_id IS NULL
      OR coach_reference_id = public.coaching_04_active_coach_reference_id()
    )
    AND public.coaching_04_coach_assigned_to_player(player_id, program_id)
  );

-- evaluations UPDATE draft only for assigned player
CREATE POLICY coaching_04_evaluations_update ON public.coaching_evaluations
  FOR UPDATE TO authenticated
  USING (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.evaluation.submit')
    AND status = 'draft'
    AND public.coaching_04_coach_assigned_to_player(player_id, program_id)
    AND public.coaching_04_active_coach_reference_id() IS NOT NULL
    AND (
      coach_reference_id IS NULL
      OR coach_reference_id = public.coaching_04_active_coach_reference_id()
    )
  )
  WITH CHECK (
    public.coaching_02_scope_allows(tenant_id, club_id)
    AND public.coaching_04_has_assigned_action('coaching.assigned.evaluation.submit')
    AND public.coaching_04_coach_assigned_to_player(player_id, program_id)
    AND public.coaching_04_active_coach_reference_id() IS NOT NULL
    AND (
      coach_reference_id IS NULL
      OR coach_reference_id = public.coaching_04_active_coach_reference_id()
    )
  );

-- NO coaching_04 UPDATE policy on coaching_package_entitlements
-- (coaching.assigned.entitlement.consume is RPC-only).

-- NO PLAYER policies.
-- NO DELETE policies for clients.
