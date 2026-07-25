-- =============================================================================
-- PM-ID-01 — Mapping management RPCs (admin)
-- Depends on: 10_*, 20_*, 30_*
-- AUTHORED ONLY — Owner GO required for Staging apply.
-- Does NOT seed permissions. Interim gate: user.manage / super admin.
-- Proposed (not granted): player.identity_link.manage
-- No PLAYER/COACH self-link path.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.player_identity_admin_can_manage(
  p_tenant_id text,
  p_club_id text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant text := nullif(trim(coalesce(p_tenant_id, '')), '');
  v_club text := nullif(trim(coalesce(p_club_id, '')), '');
BEGIN
  IF v_uid IS NULL OR v_tenant IS NULL OR v_club IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = v_club AND c.tenant_id = v_tenant
  ) THEN
    RETURN false;
  END IF;

  IF public.is_super_admin() THEN
    RETURN true;
  END IF;

  -- Interim canonical admin gate (existing Identity permission).
  -- Dedicated player.identity_link.manage is PROPOSED ONLY — not seeded here.
  IF NOT public.user_has_permission('user.manage') THEN
    RETURN false;
  END IF;

  -- Administrative scope: actor venue must match tenant (venues.id = tenant_id).
  IF public.user_venue_id() IS DISTINCT FROM v_tenant THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.player_identity_admin_can_manage(text, text) IS
  'PM-ID-01 admin gate. Interim: is_super_admin OR user.manage + venue scope. No PLAYER self-link.';

CREATE OR REPLACE FUNCTION public.player_identity_admin_upsert_link(
  p_tenant_id text,
  p_club_id text,
  p_principal_id uuid,
  p_player_id text,
  p_provenance text DEFAULT 'admin_rpc',
  p_source_system text DEFAULT 'pm-id-01',
  p_expected_version bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant text := nullif(trim(coalesce(p_tenant_id, '')), '');
  v_club text := nullif(trim(coalesce(p_club_id, '')), '');
  v_player text := nullif(trim(coalesce(p_player_id, '')), '');
  v_prov text := nullif(trim(coalesce(p_provenance, '')), '');
  v_existing public.player_identity_links%ROWTYPE;
  v_conflict_player uuid;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;

  IF NOT public.player_identity_admin_can_manage(v_tenant, v_club) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;

  IF p_principal_id IS NULL OR v_player IS NULL OR v_prov IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END IF;

  -- Fail closed on missing principal FK target
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_principal_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PRINCIPAL_NOT_FOUND');
  END IF;

  -- Deny ACTIVE player already linked to a different principal in scope
  SELECT l.principal_id INTO v_conflict_player
  FROM public.player_identity_links l
  WHERE l.tenant_id = v_tenant
    AND l.club_id = v_club
    AND l.player_id = v_player
    AND l.status = 'ACTIVE'
    AND l.principal_id IS DISTINCT FROM p_principal_id
  LIMIT 1;

  IF v_conflict_player IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PLAYER_ALREADY_MAPPED');
  END IF;

  SELECT * INTO v_existing
  FROM public.player_identity_links l
  WHERE l.tenant_id = v_tenant
    AND l.club_id = v_club
    AND l.principal_id = p_principal_id
    AND l.status = 'ACTIVE'
  LIMIT 1;

  IF FOUND THEN
    IF p_expected_version IS NOT NULL AND v_existing.version IS DISTINCT FROM p_expected_version THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'VERSION_CONFLICT',
        'current_version', v_existing.version
      );
    END IF;

    -- Idempotent same mapping
    IF v_existing.player_id = v_player THEN
      RETURN jsonb_build_object(
        'ok', true,
        'code', 'UNCHANGED',
        'link_id', v_existing.link_id,
        'version', v_existing.version,
        'status', v_existing.status
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', false,
      'code', 'PRINCIPAL_ALREADY_MAPPED',
      'link_id', v_existing.link_id,
      'version', v_existing.version
    );
  END IF;

  INSERT INTO public.player_identity_links (
    tenant_id,
    club_id,
    principal_id,
    player_id,
    status,
    version,
    provenance,
    source_system,
    created_by,
    updated_at
  ) VALUES (
    v_tenant,
    v_club,
    p_principal_id,
    v_player,
    'ACTIVE',
    1,
    v_prov,
    nullif(trim(coalesce(p_source_system, '')), ''),
    v_actor,
    now()
  )
  RETURNING * INTO v_existing;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'CREATED',
    'link_id', v_existing.link_id,
    'version', v_existing.version,
    'status', v_existing.status
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNIQUE_VIOLATION');
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FOREIGN_KEY_VIOLATION');
END;
$$;

COMMENT ON FUNCTION public.player_identity_admin_upsert_link(text, text, uuid, text, text, text, bigint) IS
  'PM-ID-01 admin upsert ACTIVE mapping. Auth from auth.uid(); subject principal explicit. Idempotent. No hard-delete.';

CREATE OR REPLACE FUNCTION public.player_identity_admin_revoke_link(
  p_tenant_id text,
  p_club_id text,
  p_principal_id uuid,
  p_expected_version bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant text := nullif(trim(coalesce(p_tenant_id, '')), '');
  v_club text := nullif(trim(coalesce(p_club_id, '')), '');
  v_existing public.player_identity_links%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;

  IF NOT public.player_identity_admin_can_manage(v_tenant, v_club) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;

  IF p_principal_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END IF;

  SELECT * INTO v_existing
  FROM public.player_identity_links l
  WHERE l.tenant_id = v_tenant
    AND l.club_id = v_club
    AND l.principal_id = p_principal_id
    AND l.status = 'ACTIVE'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  IF p_expected_version IS NOT NULL AND v_existing.version IS DISTINCT FROM p_expected_version THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VERSION_CONFLICT',
      'current_version', v_existing.version
    );
  END IF;

  UPDATE public.player_identity_links l
  SET
    status = 'REVOKED',
    revoked_at = now(),
    revoked_by = v_actor,
    version = l.version + 1,
    updated_at = now()
  WHERE l.link_id = v_existing.link_id
  RETURNING * INTO v_existing;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'REVOKED',
    'link_id', v_existing.link_id,
    'version', v_existing.version,
    'status', v_existing.status
  );
END;
$$;

COMMENT ON FUNCTION public.player_identity_admin_revoke_link(text, text, uuid, bigint) IS
  'PM-ID-01 admin soft-revoke. Retains history. Self-scope loses effect immediately.';

COMMIT;
