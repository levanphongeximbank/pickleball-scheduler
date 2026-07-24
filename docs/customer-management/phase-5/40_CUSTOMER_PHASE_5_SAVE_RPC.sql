-- =============================================================================
-- CUSTOMER-05 — Trusted save RPC (linkage current-state + history + customer sync)
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- service_role execute only. Authenticated/anon execute revoked.
-- Transaction: customer version check → history append → linkage upsert →
--              customer denormalized account/player sync + version bump.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.customer_save_linkage(
  p_linkage jsonb,
  p_history jsonb,
  p_expected_linkage_version integer DEFAULT NULL,
  p_expected_customer_version integer DEFAULT NULL,
  p_customer_version_after integer DEFAULT NULL,
  p_sync_account_user_id text DEFAULT NULL,
  p_clear_account_user_id boolean DEFAULT false,
  p_sync_player_id text DEFAULT NULL,
  p_clear_player_id boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.customer_linkages%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_linkage_id text := trim(coalesce(p_linkage->>'linkage_id', ''));
  v_customer_id text := trim(coalesce(p_linkage->>'customer_id', ''));
  v_tenant_id text := trim(coalesce(p_linkage->>'tenant_id', ''));
  v_venue_id text := trim(coalesce(p_linkage->>'venue_id', ''));
  v_version integer := coalesce((p_linkage->>'version')::integer, 0);
  v_next_customer_version integer;
BEGIN
  IF v_linkage_id = '' OR v_customer_id = '' OR v_tenant_id = '' OR v_venue_id = '' THEN
    RAISE EXCEPTION 'customer_save_linkage: required identifiers missing'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_customer
  FROM public.customers c
  WHERE c.customer_id = v_customer_id
    AND c.tenant_id = v_tenant_id
    AND c.venue_id = v_venue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_save_linkage: parent customer missing'
      USING ERRCODE = '23503';
  END IF;

  IF p_expected_customer_version IS NOT NULL
     AND v_customer.version <> p_expected_customer_version THEN
    RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing
  FROM public.customer_linkages
  WHERE linkage_id = v_linkage_id
  FOR UPDATE;

  IF p_expected_linkage_version IS NOT NULL THEN
    IF NOT FOUND AND p_expected_linkage_version <> 0 THEN
      RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT'
        USING ERRCODE = 'P0001';
    END IF;
    IF FOUND AND v_existing.version <> p_expected_linkage_version THEN
      RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.customer_linkage_history (
    history_id, linkage_id, customer_id, tenant_id, venue_id, linkage_type,
    external_reference_id, previous_status, next_status, action, source, reason,
    evidence_reference, actor_reference, effective_at, sequence, customer_version,
    recorded_at
  ) VALUES (
    p_history->>'history_id',
    p_history->>'linkage_id',
    p_history->>'customer_id',
    p_history->>'tenant_id',
    p_history->>'venue_id',
    p_history->>'linkage_type',
    p_history->>'external_reference_id',
    nullif(p_history->>'previous_status', ''),
    p_history->>'next_status',
    p_history->>'action',
    nullif(p_history->>'source', ''),
    nullif(p_history->>'reason', ''),
    nullif(p_history->>'evidence_reference', ''),
    nullif(p_history->>'actor_reference', ''),
    nullif(p_history->>'effective_at', '')::timestamptz,
    (p_history->>'sequence')::integer,
    (p_history->>'customer_version')::integer,
    (p_history->>'recorded_at')::timestamptz
  );

  INSERT INTO public.customer_linkages AS l (
    linkage_id, customer_id, tenant_id, venue_id, linkage_type,
    external_reference_id, external_reference_type, external_system, status,
    source, evidence_reference, actor_reference, effective_at, ended_at,
    version, created_at, updated_at
  ) VALUES (
    v_linkage_id,
    v_customer_id,
    v_tenant_id,
    v_venue_id,
    p_linkage->>'linkage_type',
    p_linkage->>'external_reference_id',
    p_linkage->>'external_reference_type',
    p_linkage->>'external_system',
    p_linkage->>'status',
    p_linkage->>'source',
    nullif(p_linkage->>'evidence_reference', ''),
    nullif(p_linkage->>'actor_reference', ''),
    (p_linkage->>'effective_at')::timestamptz,
    nullif(p_linkage->>'ended_at', '')::timestamptz,
    v_version,
    (p_linkage->>'created_at')::timestamptz,
    (p_linkage->>'updated_at')::timestamptz
  )
  ON CONFLICT (linkage_id) DO UPDATE
  SET status = EXCLUDED.status,
      source = EXCLUDED.source,
      evidence_reference = EXCLUDED.evidence_reference,
      actor_reference = EXCLUDED.actor_reference,
      effective_at = EXCLUDED.effective_at,
      ended_at = EXCLUDED.ended_at,
      external_reference_id = EXCLUDED.external_reference_id,
      external_reference_type = EXCLUDED.external_reference_type,
      external_system = EXCLUDED.external_system,
      version = EXCLUDED.version,
      updated_at = EXCLUDED.updated_at;

  v_next_customer_version := coalesce(p_customer_version_after, v_customer.version + 1);

  UPDATE public.customers
  SET version = v_next_customer_version,
      updated_at = (p_linkage->>'updated_at')::timestamptz,
      account_user_id = CASE
        WHEN p_clear_account_user_id THEN NULL
        WHEN p_sync_account_user_id IS NOT NULL THEN p_sync_account_user_id
        ELSE account_user_id
      END,
      player_id = CASE
        WHEN p_clear_player_id THEN NULL
        WHEN p_sync_player_id IS NOT NULL THEN p_sync_player_id
        ELSE player_id
      END
  WHERE customer_id = v_customer_id
    AND tenant_id = v_tenant_id
    AND venue_id = v_venue_id;

  RETURN (
    SELECT to_jsonb(l.*)
    FROM public.customer_linkages l
    WHERE l.linkage_id = v_linkage_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.customer_save_linkage(
  jsonb, jsonb, integer, integer, integer, text, boolean, text, boolean
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_save_linkage(
  jsonb, jsonb, integer, integer, integer, text, boolean, text, boolean
) FROM anon;
REVOKE ALL ON FUNCTION public.customer_save_linkage(
  jsonb, jsonb, integer, integer, integer, text, boolean, text, boolean
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.customer_save_linkage(
  jsonb, jsonb, integer, integer, integer, text, boolean, text, boolean
) TO service_role;

COMMENT ON FUNCTION public.customer_save_linkage IS
  'CUSTOMER-05 trusted transactional linkage write. service_role only.';
