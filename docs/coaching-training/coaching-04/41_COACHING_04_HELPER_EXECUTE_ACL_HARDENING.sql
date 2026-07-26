-- =============================================================================
-- COACHING-04 — Helper EXECUTE ACL hardening (additive patch)
-- Order: 41 (next unused forward slot after 40)
-- Purpose: Revoke accidental anon/service_role EXECUTE on the 12 SECURITY
--          DEFINER helpers that retained broad grants after Staging apply.
-- Status: AUTHORED ONLY — do not apply without
--         COACHING_04_HELPER_ACL_PATCH_OWNER_GO bound to exact patch commit.
--
-- Explicit:
--   - Does NOT CREATE OR REPLACE any function.
--   - Does NOT alter function bodies.
--   - Does NOT alter RLS policies.
--   - Does NOT re-run forward SQL 10/11/20/21/30/40.
--   - Does NOT touch mutation RPCs (already hardened in 30_*).
--   - REVOKE PUBLIC / anon / service_role EXECUTE on exact 12 helpers.
--   - GRANT EXECUTE TO authenticated (required for RLS policy evaluation).
--   - No mapping / backfill / runtime / localStorage / Production.
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- Assignment helpers (from 10_*)
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.coaching_04_actor_uid() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_04_actor_uid() FROM anon;
REVOKE ALL ON FUNCTION public.coaching_04_actor_uid() FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_04_actor_uid() TO authenticated;

REVOKE ALL ON FUNCTION public.coaching_04_active_coach_reference_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_04_active_coach_reference_id() FROM anon;
REVOKE ALL ON FUNCTION public.coaching_04_active_coach_reference_id() FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_04_active_coach_reference_id() TO authenticated;

REVOKE ALL ON FUNCTION public.coaching_04_coach_assigned_to_player(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_04_coach_assigned_to_player(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.coaching_04_coach_assigned_to_player(text, text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_04_coach_assigned_to_player(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.coaching_04_coach_owns_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_04_coach_owns_session(text) FROM anon;
REVOKE ALL ON FUNCTION public.coaching_04_coach_owns_session(text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_04_coach_owns_session(text) TO authenticated;

REVOKE ALL ON FUNCTION public.coaching_04_coach_can_access_enrollment(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_04_coach_can_access_enrollment(text) FROM anon;
REVOKE ALL ON FUNCTION public.coaching_04_coach_can_access_enrollment(text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_04_coach_can_access_enrollment(text) TO authenticated;

REVOKE ALL ON FUNCTION public.coaching_04_coach_can_access_program(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_04_coach_can_access_program(text) FROM anon;
REVOKE ALL ON FUNCTION public.coaching_04_coach_can_access_program(text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_04_coach_can_access_program(text) TO authenticated;

REVOKE ALL ON FUNCTION public.coaching_04_has_assigned_action(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_04_has_assigned_action(text) FROM anon;
REVOKE ALL ON FUNCTION public.coaching_04_has_assigned_action(text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_04_has_assigned_action(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- PLAYER self-scope helpers (from 11_*)
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.coaching_04_mapped_player_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_04_mapped_player_id() FROM anon;
REVOKE ALL ON FUNCTION public.coaching_04_mapped_player_id() FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_04_mapped_player_id() TO authenticated;

REVOKE ALL ON FUNCTION public.coaching_04_player_is_self(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_04_player_is_self(text) FROM anon;
REVOKE ALL ON FUNCTION public.coaching_04_player_is_self(text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_04_player_is_self(text) TO authenticated;

REVOKE ALL ON FUNCTION public.coaching_04_player_identity_is_mapped() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_04_player_identity_is_mapped() FROM anon;
REVOKE ALL ON FUNCTION public.coaching_04_player_identity_is_mapped() FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_04_player_identity_is_mapped() TO authenticated;

REVOKE ALL ON FUNCTION public.coaching_04_has_self_action(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_04_has_self_action(text) FROM anon;
REVOKE ALL ON FUNCTION public.coaching_04_has_self_action(text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_04_has_self_action(text) TO authenticated;

REVOKE ALL ON FUNCTION public.coaching_04_player_can_access_enrollment(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_04_player_can_access_enrollment(text) FROM anon;
REVOKE ALL ON FUNCTION public.coaching_04_player_can_access_enrollment(text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_04_player_can_access_enrollment(text) TO authenticated;
