-- =============================================================================
-- CUSTOMER-04 — Trusted save RPCs (current-state + history transaction)
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- service_role execute only. Authenticated/anon execute revoked.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.customer_save_consent(
  p_consent jsonb,
  p_history jsonb,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.customer_consents%ROWTYPE;
  v_consent_id text := trim(coalesce(p_consent->>'consent_id', ''));
  v_customer_id text := trim(coalesce(p_consent->>'customer_id', ''));
  v_tenant_id text := trim(coalesce(p_consent->>'tenant_id', ''));
  v_venue_id text := trim(coalesce(p_consent->>'venue_id', ''));
  v_purpose text := trim(coalesce(p_consent->>'purpose', ''));
  v_channel text := nullif(trim(coalesce(p_consent->>'channel', '')), '');
  v_version integer := coalesce((p_consent->>'version')::integer, 0);
BEGIN
  IF v_consent_id = '' OR v_customer_id = '' OR v_tenant_id = '' OR v_venue_id = '' THEN
    RAISE EXCEPTION 'customer_save_consent: required identifiers missing'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.customer_id = v_customer_id
      AND c.tenant_id = v_tenant_id
      AND c.venue_id = v_venue_id
  ) THEN
    RAISE EXCEPTION 'customer_save_consent: parent customer missing'
      USING ERRCODE = '23503';
  END IF;

  SELECT * INTO v_existing
  FROM public.customer_consents
  WHERE tenant_id = v_tenant_id
    AND venue_id = v_venue_id
    AND customer_id = v_customer_id
    AND purpose = v_purpose
    AND channel IS NOT DISTINCT FROM v_channel
  FOR UPDATE;

  IF p_expected_version IS NOT NULL THEN
    IF NOT FOUND AND p_expected_version <> 0 THEN
      RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT'
        USING ERRCODE = 'P0001';
    END IF;
    IF FOUND AND v_existing.version <> p_expected_version THEN
      RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.customer_consent_history (
    history_id, consent_id, customer_id, tenant_id, venue_id, sequence,
    previous_status, next_status, purpose, channel, effective_at, source,
    evidence_reference, actor_reference, reason, aggregate_version, recorded_at
  ) VALUES (
    p_history->>'history_id',
    p_history->>'consent_id',
    p_history->>'customer_id',
    p_history->>'tenant_id',
    p_history->>'venue_id',
    (p_history->>'sequence')::integer,
    p_history->>'previous_status',
    p_history->>'next_status',
    p_history->>'purpose',
    nullif(p_history->>'channel', ''),
    nullif(p_history->>'effective_at', '')::timestamptz,
    nullif(p_history->>'source', ''),
    nullif(p_history->>'evidence_reference', ''),
    nullif(p_history->>'actor_reference', ''),
    nullif(p_history->>'reason', ''),
    (p_history->>'aggregate_version')::integer,
    (p_history->>'recorded_at')::timestamptz
  );

  INSERT INTO public.customer_consents AS c (
    consent_id, customer_id, tenant_id, venue_id, purpose, channel, status,
    effective_at, expires_at, revoked_at, source, evidence_reference,
    actor_reference, captured_at, version, created_at, updated_at
  ) VALUES (
    v_consent_id,
    v_customer_id,
    v_tenant_id,
    v_venue_id,
    v_purpose,
    v_channel,
    p_consent->>'status',
    (p_consent->>'effective_at')::timestamptz,
    nullif(p_consent->>'expires_at', '')::timestamptz,
    nullif(p_consent->>'revoked_at', '')::timestamptz,
    p_consent->>'source',
    nullif(p_consent->>'evidence_reference', ''),
    nullif(p_consent->>'actor_reference', ''),
    (p_consent->>'captured_at')::timestamptz,
    v_version,
    (p_consent->>'created_at')::timestamptz,
    (p_consent->>'updated_at')::timestamptz
  )
  ON CONFLICT (consent_id) DO UPDATE
  SET status = EXCLUDED.status,
      effective_at = EXCLUDED.effective_at,
      expires_at = EXCLUDED.expires_at,
      revoked_at = EXCLUDED.revoked_at,
      source = EXCLUDED.source,
      evidence_reference = EXCLUDED.evidence_reference,
      actor_reference = EXCLUDED.actor_reference,
      captured_at = EXCLUDED.captured_at,
      version = EXCLUDED.version,
      updated_at = EXCLUDED.updated_at;

  RETURN to_jsonb((
    SELECT c FROM public.customer_consents c WHERE c.consent_id = v_consent_id
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_save_preference(
  p_preference jsonb,
  p_history jsonb,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.customer_communication_preferences%ROWTYPE;
  v_preference_id text := trim(coalesce(p_preference->>'preference_id', ''));
  v_customer_id text := trim(coalesce(p_preference->>'customer_id', ''));
  v_tenant_id text := trim(coalesce(p_preference->>'tenant_id', ''));
  v_venue_id text := trim(coalesce(p_preference->>'venue_id', ''));
  v_purpose text := trim(coalesce(p_preference->>'purpose', ''));
  v_channel text := trim(coalesce(p_preference->>'channel', ''));
  v_version integer := coalesce((p_preference->>'version')::integer, 0);
BEGIN
  IF v_preference_id = '' OR v_customer_id = '' OR v_tenant_id = '' OR v_venue_id = '' THEN
    RAISE EXCEPTION 'customer_save_preference: required identifiers missing'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.customer_id = v_customer_id
      AND c.tenant_id = v_tenant_id
      AND c.venue_id = v_venue_id
  ) THEN
    RAISE EXCEPTION 'customer_save_preference: parent customer missing'
      USING ERRCODE = '23503';
  END IF;

  SELECT * INTO v_existing
  FROM public.customer_communication_preferences
  WHERE tenant_id = v_tenant_id
    AND venue_id = v_venue_id
    AND customer_id = v_customer_id
    AND purpose = v_purpose
    AND channel = v_channel
  FOR UPDATE;

  IF p_expected_version IS NOT NULL THEN
    IF NOT FOUND AND p_expected_version <> 0 THEN
      RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT'
        USING ERRCODE = 'P0001';
    END IF;
    IF FOUND AND v_existing.version <> p_expected_version THEN
      RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.customer_preference_history (
    history_id, preference_id, customer_id, tenant_id, venue_id, sequence,
    previous_status, next_status, purpose, channel, effective_at, source,
    actor_reference, reason, aggregate_version, recorded_at
  ) VALUES (
    p_history->>'history_id',
    p_history->>'preference_id',
    p_history->>'customer_id',
    p_history->>'tenant_id',
    p_history->>'venue_id',
    (p_history->>'sequence')::integer,
    p_history->>'previous_status',
    p_history->>'next_status',
    p_history->>'purpose',
    p_history->>'channel',
    nullif(p_history->>'effective_at', '')::timestamptz,
    nullif(p_history->>'source', ''),
    nullif(p_history->>'actor_reference', ''),
    nullif(p_history->>'reason', ''),
    (p_history->>'aggregate_version')::integer,
    (p_history->>'recorded_at')::timestamptz
  );

  INSERT INTO public.customer_communication_preferences AS p (
    preference_id, customer_id, tenant_id, venue_id, purpose, channel, status,
    effective_at, source, actor_reference, version, created_at, updated_at
  ) VALUES (
    v_preference_id,
    v_customer_id,
    v_tenant_id,
    v_venue_id,
    v_purpose,
    v_channel,
    p_preference->>'status',
    (p_preference->>'effective_at')::timestamptz,
    p_preference->>'source',
    nullif(p_preference->>'actor_reference', ''),
    v_version,
    (p_preference->>'created_at')::timestamptz,
    (p_preference->>'updated_at')::timestamptz
  )
  ON CONFLICT (preference_id) DO UPDATE
  SET status = EXCLUDED.status,
      effective_at = EXCLUDED.effective_at,
      source = EXCLUDED.source,
      actor_reference = EXCLUDED.actor_reference,
      version = EXCLUDED.version,
      updated_at = EXCLUDED.updated_at;

  RETURN to_jsonb((
    SELECT p FROM public.customer_communication_preferences p
    WHERE p.preference_id = v_preference_id
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.customer_save_consent(jsonb, jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_save_consent(jsonb, jsonb, integer) FROM anon;
REVOKE ALL ON FUNCTION public.customer_save_consent(jsonb, jsonb, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.customer_save_consent(jsonb, jsonb, integer) TO service_role;

REVOKE ALL ON FUNCTION public.customer_save_preference(jsonb, jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_save_preference(jsonb, jsonb, integer) FROM anon;
REVOKE ALL ON FUNCTION public.customer_save_preference(jsonb, jsonb, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.customer_save_preference(jsonb, jsonb, integer) TO service_role;

COMMENT ON FUNCTION public.customer_save_consent(jsonb, jsonb, integer) IS
  'CUSTOMER-04 trusted transactional consent current-state + history write. service_role only.';

COMMENT ON FUNCTION public.customer_save_preference(jsonb, jsonb, integer) IS
  'CUSTOMER-04 trusted transactional preference current-state + history write. service_role only.';
