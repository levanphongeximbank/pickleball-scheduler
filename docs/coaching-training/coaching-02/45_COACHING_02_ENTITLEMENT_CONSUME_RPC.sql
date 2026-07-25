-- =============================================================================
-- COACHING-02 — Atomic package entitlement consumption RPC
-- Purpose: Single client-write path for entitlement consumption + usage ledger.
-- Status: AUTHORED ONLY — do not apply in COACHING-02.
--
-- Authenticated callers have no UPDATE on coaching_package_entitlements and no
-- INSERT on coaching_package_usage_events (see 50_COACHING_02_GRANTS.sql).
-- Grant lifecycle uses INSERT-only on entitlements for authenticated clients.
--
-- Actor integrity: usage actor_id is ALWAYS auth.uid()::text.
-- No p_actor_id parameter. service_role EXECUTE NOT granted (deferred).
-- =============================================================================

SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, text, timestamptz
);
DROP FUNCTION IF EXISTS public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, timestamptz
);

CREATE OR REPLACE FUNCTION public.coaching_consume_entitlement(
  p_tenant_id text,
  p_club_id text,
  p_entitlement_id text,
  p_expected_version integer,
  p_player_id text,
  p_idempotency_key text,
  p_usage_event_id text,
  p_consumed_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor_id text;
  v_ent public.coaching_package_entitlements%ROWTYPE;
  v_pkg public.coaching_packages%ROWTYPE;
  v_existing_usage public.coaching_package_usage_events%ROWTYPE;
  v_usage public.coaching_package_usage_events%ROWTYPE;
  v_now timestamptz := now();
  v_at timestamptz;
  v_next_consumed integer;
  v_next_remaining integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'COACHING_MISSING_ACTOR'
      USING ERRCODE = '42501';
  END IF;

  v_actor_id := v_uid::text;

  IF length(trim(coalesce(p_tenant_id, ''))) = 0
     OR length(trim(coalesce(p_club_id, ''))) = 0 THEN
    RAISE EXCEPTION 'COACHING_MISSING_SCOPE'
      USING ERRCODE = '42501';
  END IF;

  IF public.user_venue_id() IS NULL OR public.user_club_id() IS NULL THEN
    RAISE EXCEPTION 'COACHING_MISSING_SCOPE'
      USING ERRCODE = '42501';
  END IF;

  IF p_tenant_id <> public.user_venue_id() OR p_club_id <> public.user_club_id() THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_SCOPE'
      USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.is_super_admin()
    OR public.user_has_permission('coaching.entitlement.consume')
  ) THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_ACTION'
      USING ERRCODE = '42501';
  END IF;

  IF p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION 'COACHING_INVALID_INPUT: expectedVersion required'
      USING ERRCODE = '22023';
  END IF;

  IF length(trim(coalesce(p_player_id, ''))) = 0 THEN
    RAISE EXCEPTION 'COACHING_INVALID_INPUT: player_id required'
      USING ERRCODE = '22023';
  END IF;

  IF length(trim(coalesce(p_idempotency_key, ''))) = 0 THEN
    RAISE EXCEPTION 'COACHING_INVALID_INPUT: idempotency_key required'
      USING ERRCODE = '22023';
  END IF;

  IF length(trim(coalesce(p_usage_event_id, ''))) = 0 THEN
    RAISE EXCEPTION 'COACHING_INVALID_INPUT: usage_event_id required'
      USING ERRCODE = '22023';
  END IF;

  v_at := coalesce(p_consumed_at, v_now);

  SELECT *
  INTO v_existing_usage
  FROM public.coaching_package_usage_events
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    SELECT *
    INTO v_ent
    FROM public.coaching_package_entitlements
    WHERE tenant_id = p_tenant_id
      AND club_id = p_club_id
      AND entitlement_id = v_existing_usage.entitlement_id;

    RETURN jsonb_build_object(
      'entitlement', to_jsonb(v_ent),
      'usageEvent', to_jsonb(v_existing_usage),
      'idempotentReplay', true
    );
  END IF;

  SELECT *
  INTO v_ent
  FROM public.coaching_package_entitlements
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND entitlement_id = p_entitlement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COACHING_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_ent.version <> p_expected_version THEN
    RAISE EXCEPTION 'COACHING_VERSION_CONFLICT'
      USING ERRCODE = '40001';
  END IF;

  IF v_ent.player_id <> p_player_id THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_SCOPE: cross-player entitlement use'
      USING ERRCODE = '42501';
  END IF;

  IF v_ent.status NOT IN ('active') THEN
    RAISE EXCEPTION 'COACHING_INVALID_TRANSITION: entitlement not active'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_pkg
  FROM public.coaching_packages
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND package_id = v_ent.package_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COACHING_NOT_FOUND: package'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_pkg.status IN ('draft', 'expired', 'archived') THEN
    RAISE EXCEPTION 'COACHING_INVALID_TRANSITION: package inactive/cancelled'
      USING ERRCODE = '22023';
  END IF;

  IF v_ent.sessions_remaining < 1 THEN
    RAISE EXCEPTION 'COACHING_ENTITLEMENT_EXHAUSTED'
      USING ERRCODE = '22023';
  END IF;

  IF v_ent.valid_from IS NOT NULL AND v_at < v_ent.valid_from THEN
    RAISE EXCEPTION 'COACHING_INVALID_TRANSITION: before validFrom'
      USING ERRCODE = '22023';
  END IF;

  IF v_ent.valid_to IS NOT NULL AND v_at > v_ent.valid_to THEN
    RAISE EXCEPTION 'COACHING_INVALID_TRANSITION: after validTo'
      USING ERRCODE = '22023';
  END IF;

  v_next_consumed := v_ent.sessions_consumed + 1;
  v_next_remaining := v_ent.sessions_granted - v_next_consumed;

  IF v_next_remaining < 0 THEN
    RAISE EXCEPTION 'COACHING_ENTITLEMENT_EXHAUSTED'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.coaching_package_entitlements
  SET
    sessions_consumed = v_next_consumed,
    sessions_remaining = v_next_remaining,
    status = CASE WHEN v_next_remaining = 0 THEN 'exhausted' ELSE status END,
    version = version + 1,
    updated_at = v_at
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND entitlement_id = p_entitlement_id
    AND version = p_expected_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COACHING_VERSION_CONFLICT'
      USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.coaching_package_usage_events (
    usage_event_id,
    tenant_id,
    club_id,
    venue_id,
    entitlement_id,
    package_id,
    player_id,
    sessions_delta,
    remaining_after,
    idempotency_key,
    actor_id,
    consumed_at,
    created_at,
    version
  ) VALUES (
    p_usage_event_id,
    p_tenant_id,
    p_club_id,
    v_ent.venue_id,
    p_entitlement_id,
    v_ent.package_id,
    p_player_id,
    1,
    v_next_remaining,
    trim(p_idempotency_key),
    v_actor_id,
    v_at,
    v_now,
    1
  )
  RETURNING * INTO v_usage;

  SELECT *
  INTO v_ent
  FROM public.coaching_package_entitlements
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND entitlement_id = p_entitlement_id;

  RETURN jsonb_build_object(
    'entitlement', to_jsonb(v_ent),
    'usageEvent', to_jsonb(v_usage),
    'idempotentReplay', false
  );
END;
$$;

COMMENT ON FUNCTION public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, timestamptz
) IS
  'COACHING-02 atomic entitlement consume. Actor from auth.uid() only. Authenticated EXECUTE; no service_role grant.';

REVOKE ALL ON FUNCTION public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, timestamptz
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, timestamptz
) FROM anon;

REVOKE ALL ON FUNCTION public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, timestamptz
) FROM authenticated;

REVOKE ALL ON FUNCTION public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, timestamptz
) FROM service_role;
