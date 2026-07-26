-- =============================================================================
-- COACHING-04 — Assignment-aware SECURITY DEFINER helpers
-- Purpose: Resolve active coach reference from JWT and gate assigned access.
-- Status: AUTHORED ONLY — do not apply without Owner GO.
--
-- Coach binding (AUTHORS):
--   auth.uid() = JWT actor
--   coaching_coach_references.coach_principal_id = auth.uid()::text
--   tenant_id = user_venue_id(), club_id = user_club_id()
--   relationship status active|inactive (inactive = revoked / deny-immediately)
--
-- PLAYER self-scope helpers live in 11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS.sql
-- (PM-ID-01 consumer). Do not invent profiles.player_id reuse here.
--
-- Depends on: coaching_02_scope_allows, coaching_02_has_action, identity helpers.
-- Fail-closed. Fixed search_path. REVOKE PUBLIC. GRANT authenticated.
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- coaching_04_actor_uid()
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_04_actor_uid()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    ELSE auth.uid()::text
  END;
$$;

COMMENT ON FUNCTION public.coaching_04_actor_uid() IS
  'COACHING-04 JWT actor as text. NULL when unauthenticated. Fail-closed.';

REVOKE ALL ON FUNCTION public.coaching_04_actor_uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coaching_04_actor_uid() TO authenticated;

-- -----------------------------------------------------------------------------
-- coaching_04_active_coach_reference_id()
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_04_active_coach_reference_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT cr.coach_reference_id
  FROM public.coaching_coach_references cr
  WHERE auth.uid() IS NOT NULL
    AND public.user_venue_id() IS NOT NULL
    AND public.user_club_id() IS NOT NULL
    AND cr.status = 'active'
    AND cr.coach_principal_id = auth.uid()::text
    AND cr.tenant_id = public.user_venue_id()
    AND cr.club_id = public.user_club_id()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.coaching_04_active_coach_reference_id() IS
  'COACHING-04 resolves active coach_reference_id for JWT principal in venue/club scope. NULL if missing/inactive.';

REVOKE ALL ON FUNCTION public.coaching_04_active_coach_reference_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coaching_04_active_coach_reference_id() TO authenticated;

-- -----------------------------------------------------------------------------
-- coaching_04_coach_assigned_to_player(p_player_id, p_program_id DEFAULT NULL)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_04_coach_assigned_to_player(
  p_player_id text,
  p_program_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND length(trim(coalesce(p_player_id, ''))) > 0
    AND public.coaching_04_active_coach_reference_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.coaching_coach_player_relationships r
      WHERE r.coach_reference_id = public.coaching_04_active_coach_reference_id()
        AND r.player_id = p_player_id
        AND r.status = 'active'
        AND public.coaching_02_scope_allows(r.tenant_id, r.club_id)
        AND (
          p_program_id IS NULL
          OR length(trim(p_program_id)) = 0
          OR r.program_id IS NULL
          OR r.program_id = p_program_id
        )
    );
$$;

COMMENT ON FUNCTION public.coaching_04_coach_assigned_to_player(text, text) IS
  'COACHING-04 true when caller has an active coach–player relationship (optional program filter). Inactive = false.';

REVOKE ALL ON FUNCTION public.coaching_04_coach_assigned_to_player(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coaching_04_coach_assigned_to_player(text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- coaching_04_coach_owns_session(p_session_id)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_04_coach_owns_session(
  p_session_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND length(trim(coalesce(p_session_id, ''))) > 0
    AND public.coaching_04_active_coach_reference_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.coaching_training_sessions s
      WHERE s.session_id = p_session_id
        AND s.coach_reference_id = public.coaching_04_active_coach_reference_id()
        AND public.coaching_02_scope_allows(s.tenant_id, s.club_id)
    );
$$;

COMMENT ON FUNCTION public.coaching_04_coach_owns_session(text) IS
  'COACHING-04 true when session.coach_reference_id equals caller active coach ref in scope.';

REVOKE ALL ON FUNCTION public.coaching_04_coach_owns_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coaching_04_coach_owns_session(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- coaching_04_coach_can_access_enrollment(p_enrollment_id)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_04_coach_can_access_enrollment(
  p_enrollment_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND length(trim(coalesce(p_enrollment_id, ''))) > 0
    AND public.coaching_04_active_coach_reference_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.coaching_enrollments e
      WHERE e.enrollment_id = p_enrollment_id
        AND public.coaching_02_scope_allows(e.tenant_id, e.club_id)
        AND public.coaching_04_coach_assigned_to_player(e.player_id, e.program_id)
    );
$$;

COMMENT ON FUNCTION public.coaching_04_coach_can_access_enrollment(text) IS
  'COACHING-04 true when enrollment player is actively assigned to caller (program-aware).';

REVOKE ALL ON FUNCTION public.coaching_04_coach_can_access_enrollment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coaching_04_coach_can_access_enrollment(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- coaching_04_coach_can_access_program(p_program_id)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_04_coach_can_access_program(
  p_program_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND length(trim(coalesce(p_program_id, ''))) > 0
    AND public.coaching_04_active_coach_reference_id() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.coaching_coach_player_relationships r
        WHERE r.coach_reference_id = public.coaching_04_active_coach_reference_id()
          AND r.status = 'active'
          AND public.coaching_02_scope_allows(r.tenant_id, r.club_id)
          AND (r.program_id IS NULL OR r.program_id = p_program_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.coaching_training_sessions s
        WHERE s.program_id = p_program_id
          AND s.coach_reference_id = public.coaching_04_active_coach_reference_id()
          AND public.coaching_02_scope_allows(s.tenant_id, s.club_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.coaching_enrollments e
        WHERE e.program_id = p_program_id
          AND public.coaching_02_scope_allows(e.tenant_id, e.club_id)
          AND public.coaching_04_coach_assigned_to_player(e.player_id, e.program_id)
      )
    );
$$;

COMMENT ON FUNCTION public.coaching_04_coach_can_access_program(text) IS
  'COACHING-04 true when caller reaches program via active assignment, owned session, or assigned enrollment.';

REVOKE ALL ON FUNCTION public.coaching_04_coach_can_access_program(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coaching_04_coach_can_access_program(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- coaching_04_has_assigned_action(p_action)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_04_has_assigned_action(
  p_action text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND length(trim(coalesce(p_action, ''))) > 0
    AND public.coaching_02_has_action(p_action);
$$;

COMMENT ON FUNCTION public.coaching_04_has_assigned_action(text) IS
  'COACHING-04 action gate: requires authenticated caller then coaching_02_has_action. Unknown action denies.';

REVOKE ALL ON FUNCTION public.coaching_04_has_assigned_action(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coaching_04_has_assigned_action(text) TO authenticated;

-- =============================================================================
-- PLAYER mapping helpers are authored in:
--   11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS.sql
-- Do NOT add profiles.player_id / email / phone equality helpers in this file.
-- =============================================================================
