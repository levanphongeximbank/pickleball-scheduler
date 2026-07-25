-- =============================================================================
-- PM-ID-01 — Resolution helpers
-- Depends on: 10_*, 20_*
-- AUTHORED ONLY — Owner GO required for Staging apply.
-- Principal always from auth.uid(). No caller principal argument.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.player_identity_resolve_mapping(
  p_tenant_id text,
  p_club_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant text := nullif(trim(coalesce(p_tenant_id, '')), '');
  v_club text := nullif(trim(coalesce(p_club_id, '')), '');
  v_active_count int := 0;
  v_revoked_count int := 0;
  v_player_id text := NULL;
  v_club_ok boolean := false;
  v_membership_active boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'INVALID',
      'player_id', NULL,
      'tenant_id', v_tenant,
      'club_id', v_club,
      'source', NULL,
      'reason_code', 'UNAUTHENTICATED'
    );
  END IF;

  IF v_tenant IS NULL OR v_club IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'INVALID',
      'player_id', NULL,
      'tenant_id', v_tenant,
      'club_id', v_club,
      'source', NULL,
      'reason_code', 'SCOPE_REQUIRED'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.clubs c
    WHERE c.id = v_club
      AND c.tenant_id = v_tenant
  ) INTO v_club_ok;

  IF NOT v_club_ok THEN
    RETURN jsonb_build_object(
      'status', 'INVALID',
      'player_id', NULL,
      'tenant_id', v_tenant,
      'club_id', v_club,
      'source', NULL,
      'reason_code', 'TENANT_CLUB_MISMATCH'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.club_members m
    WHERE m.tenant_id = v_tenant
      AND m.club_id = v_club
      AND m.user_id = v_uid
      AND m.status = 'active'
  ) INTO v_membership_active;

  SELECT
    count(*) FILTER (WHERE l.status = 'ACTIVE'),
    count(*) FILTER (WHERE l.status = 'REVOKED')
  INTO v_active_count, v_revoked_count
  FROM public.player_identity_links l
  WHERE l.tenant_id = v_tenant
    AND l.club_id = v_club
    AND l.principal_id = v_uid;

  IF v_active_count > 1 THEN
    RETURN jsonb_build_object(
      'status', 'AMBIGUOUS',
      'player_id', NULL,
      'tenant_id', v_tenant,
      'club_id', v_club,
      'source', 'player_identity_links',
      'reason_code', 'MULTIPLE_ACTIVE_LINKS'
    );
  END IF;

  IF v_active_count = 1 THEN
    SELECT l.player_id INTO v_player_id
    FROM public.player_identity_links l
    WHERE l.tenant_id = v_tenant
      AND l.club_id = v_club
      AND l.principal_id = v_uid
      AND l.status = 'ACTIVE';

    IF v_player_id IS NULL OR length(trim(v_player_id)) = 0 THEN
      RETURN jsonb_build_object(
        'status', 'INVALID',
        'player_id', NULL,
        'tenant_id', v_tenant,
        'club_id', v_club,
        'source', 'player_identity_links',
        'reason_code', 'MALFORMED_PLAYER_ID'
      );
    END IF;

    IF NOT v_membership_active THEN
      RETURN jsonb_build_object(
        'status', 'INACTIVE',
        'player_id', NULL,
        'tenant_id', v_tenant,
        'club_id', v_club,
        'source', 'player_identity_links',
        'reason_code', 'MEMBERSHIP_INACTIVE'
      );
    END IF;

    RETURN jsonb_build_object(
      'status', 'MAPPED',
      'player_id', trim(v_player_id),
      'tenant_id', v_tenant,
      'club_id', v_club,
      'source', 'player_identity_links',
      'reason_code', 'OK'
    );
  END IF;

  IF v_revoked_count > 0 THEN
    RETURN jsonb_build_object(
      'status', 'INACTIVE',
      'player_id', NULL,
      'tenant_id', v_tenant,
      'club_id', v_club,
      'source', 'player_identity_links',
      'reason_code', 'LINK_REVOKED'
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'UNMAPPED',
    'player_id', NULL,
    'tenant_id', v_tenant,
    'club_id', v_club,
    'source', 'player_identity_links',
    'reason_code', 'NO_LINK'
  );
END;
$$;

COMMENT ON FUNCTION public.player_identity_resolve_mapping(text, text) IS
  'PM-ID-01 resolve authenticated principal → mapping status. Principal from auth.uid() only. player_id only when MAPPED.';

CREATE OR REPLACE FUNCTION public.player_identity_is_mapped(
  p_tenant_id text,
  p_club_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(
    (public.player_identity_resolve_mapping(p_tenant_id, p_club_id) ->> 'status') = 'MAPPED',
    false
  );
$$;

COMMENT ON FUNCTION public.player_identity_is_mapped(text, text) IS
  'PM-ID-01 RLS boolean helper. true only for MAPPED; false for all other statuses. No reason leakage.';

COMMIT;
