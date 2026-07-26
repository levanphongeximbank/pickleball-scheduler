-- =============================================================================
-- COACHING-04 — PLAYER self-scope SECURITY DEFINER helpers
-- Purpose: Resolve canonical Coaching player_id via PM-ID-01 only.
-- Status: AUTHORED ONLY — do not apply without COACHING_04_OWNER_GO_APPLY_STAGING.
--
-- Contract:
--   - Principal always from auth.uid() (via PM-ID-01 helpers).
--   - No caller-supplied principal_id / player_id identity arguments.
--   - Scope from trusted user_venue_id() / user_club_id() (same as COACH helpers).
--   - MAPPED + ACTIVE membership only → non-NULL player_id.
--   - UNMAPPED / INACTIVE / AMBIGUOUS / INVALID → NULL / false (fail closed).
--   - Never equate auth.uid() to player_id.
--   - Never read profiles.player_id / email / phone / display name.
--
-- Depends on:
--   - public.player_identity_resolve_mapping(text, text)  (PM-ID-01)
--   - public.player_identity_is_mapped(text, text)        (PM-ID-01)
--   - public.coaching_02_scope_allows / coaching_02_has_action
--   - public.user_venue_id() / user_club_id()
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- coaching_04_mapped_player_id()
-- Returns canonical player_id text when PM-ID-01 status = MAPPED for JWT scope.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_04_mapped_player_id()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant text := public.user_venue_id();
  v_club text := public.user_club_id();
  v_payload jsonb;
  v_status text;
  v_player_id text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_tenant IS NULL OR length(trim(v_tenant)) = 0
     OR v_club IS NULL OR length(trim(v_club)) = 0 THEN
    RETURN NULL;
  END IF;

  v_payload := public.player_identity_resolve_mapping(v_tenant, v_club);
  v_status := coalesce(v_payload ->> 'status', 'INVALID');

  IF v_status IS DISTINCT FROM 'MAPPED' THEN
    RETURN NULL;
  END IF;

  v_player_id := nullif(trim(coalesce(v_payload ->> 'player_id', '')), '');
  IF v_player_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_player_id;
END;
$$;

COMMENT ON FUNCTION public.coaching_04_mapped_player_id() IS
  'COACHING-04 PLAYER self-scope: canonical player_id via PM-ID-01 resolve. NULL unless MAPPED. Principal from auth.uid() only.';

REVOKE ALL ON FUNCTION public.coaching_04_mapped_player_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coaching_04_mapped_player_id() TO authenticated;

-- -----------------------------------------------------------------------------
-- coaching_04_player_is_self(p_player_id)
-- True only when mapped player_id equals the row player_id in current scope.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_04_player_is_self(
  p_player_id text
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
    AND public.coaching_04_mapped_player_id() IS NOT NULL
    AND public.coaching_04_mapped_player_id() = p_player_id;
$$;

COMMENT ON FUNCTION public.coaching_04_player_is_self(text) IS
  'COACHING-04 true when p_player_id equals PM-ID-01 mapped player_id for JWT tenant/club. Fail closed.';

REVOKE ALL ON FUNCTION public.coaching_04_player_is_self(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coaching_04_player_is_self(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- coaching_04_player_identity_is_mapped()
-- Boolean wrapper over PM-ID-01 for current venue/club JWT scope.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_04_player_identity_is_mapped()
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
    AND public.player_identity_is_mapped(
      public.user_venue_id(),
      public.user_club_id()
    );
$$;

COMMENT ON FUNCTION public.coaching_04_player_identity_is_mapped() IS
  'COACHING-04 boolean: PM-ID-01 mapped for JWT venue/club. false for all non-MAPPED statuses.';

REVOKE ALL ON FUNCTION public.coaching_04_player_identity_is_mapped() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coaching_04_player_identity_is_mapped() TO authenticated;

-- -----------------------------------------------------------------------------
-- coaching_04_has_self_action(p_action)
-- Permission gate for PLAYER self-scope (reuse coaching_02_has_action).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_04_has_self_action(
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

COMMENT ON FUNCTION public.coaching_04_has_self_action(text) IS
  'COACHING-04 PLAYER self-scope action gate via coaching_02_has_action. Fail closed.';

REVOKE ALL ON FUNCTION public.coaching_04_has_self_action(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coaching_04_has_self_action(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- coaching_04_player_can_access_enrollment(p_enrollment_id)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_04_player_can_access_enrollment(
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
    AND public.coaching_04_mapped_player_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.coaching_enrollments e
      WHERE e.enrollment_id = p_enrollment_id
        AND public.coaching_02_scope_allows(e.tenant_id, e.club_id)
        AND e.player_id = public.coaching_04_mapped_player_id()
    );
$$;

COMMENT ON FUNCTION public.coaching_04_player_can_access_enrollment(text) IS
  'COACHING-04 true when enrollment belongs to mapped self player_id in scope.';

REVOKE ALL ON FUNCTION public.coaching_04_player_can_access_enrollment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coaching_04_player_can_access_enrollment(text) TO authenticated;

-- Explicit NON-helpers (do not author):
--   coaching_04_player_id_from_email / phone / display_name
--   coaching_04_first_player_id()
--   any function accepting p_principal_id / p_auth_user_id as identity
