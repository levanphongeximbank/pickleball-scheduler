-- =============================================================================
-- CUSTOMER-03 — Atomic aggregate save RPC (optimistic concurrency)
-- Purpose: Transaction-safe create/update of customers + contact_points +
--          addresses with expectedVersion protection on the aggregate root.
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- Security: SECURITY DEFINER with hardened search_path. EXECUTE granted only
--           to service_role (trusted server path). No authenticated / anon /
--           PUBLIC execute — client JWT writes remain blocked in CUSTOMER-03.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.customer_save_aggregate(
  p_customer jsonb,
  p_contact_points jsonb DEFAULT '[]'::jsonb,
  p_addresses jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id text;
  v_tenant_id text;
  v_venue_id text;
  v_version integer;
  v_existing_version integer;
  v_expected_previous integer;
  v_contact jsonb;
  v_address jsonb;
  v_result jsonb;
BEGIN
  IF p_customer IS NULL OR jsonb_typeof(p_customer) <> 'object' THEN
    RAISE EXCEPTION 'customer_save_aggregate: customer payload required'
      USING ERRCODE = '22023';
  END IF;

  v_customer_id := nullif(trim(p_customer ->> 'customer_id'), '');
  v_tenant_id := nullif(trim(p_customer ->> 'tenant_id'), '');
  v_venue_id := nullif(trim(p_customer ->> 'venue_id'), '');
  v_version := (p_customer ->> 'version')::integer;

  IF v_customer_id IS NULL OR v_tenant_id IS NULL OR v_venue_id IS NULL THEN
    RAISE EXCEPTION 'customer_save_aggregate: customer_id, tenant_id, venue_id required'
      USING ERRCODE = '22023';
  END IF;

  IF v_version IS NULL OR v_version < 1 THEN
    RAISE EXCEPTION 'customer_save_aggregate: version must be >= 1'
      USING ERRCODE = '22023';
  END IF;

  IF p_contact_points IS NULL OR jsonb_typeof(p_contact_points) <> 'array' THEN
    RAISE EXCEPTION 'customer_save_aggregate: contact_points must be a jsonb array'
      USING ERRCODE = '22023';
  END IF;

  IF p_addresses IS NULL OR jsonb_typeof(p_addresses) <> 'array' THEN
    RAISE EXCEPTION 'customer_save_aggregate: addresses must be a jsonb array'
      USING ERRCODE = '22023';
  END IF;

  -- Scope consistency: children must match parent tenant/venue/customer
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_contact_points) AS cp(elem)
    WHERE nullif(trim(elem ->> 'tenant_id'), '') IS DISTINCT FROM v_tenant_id
       OR nullif(trim(elem ->> 'venue_id'), '') IS DISTINCT FROM v_venue_id
       OR nullif(trim(elem ->> 'customer_id'), '') IS DISTINCT FROM v_customer_id
  ) THEN
    RAISE EXCEPTION 'customer_save_aggregate: contact scope mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_addresses) AS ad(elem)
    WHERE nullif(trim(elem ->> 'tenant_id'), '') IS DISTINCT FROM v_tenant_id
       OR nullif(trim(elem ->> 'venue_id'), '') IS DISTINCT FROM v_venue_id
       OR nullif(trim(elem ->> 'customer_id'), '') IS DISTINCT FROM v_customer_id
  ) THEN
    RAISE EXCEPTION 'customer_save_aggregate: address scope mismatch'
      USING ERRCODE = '23514';
  END IF;

  SELECT c.version
    INTO v_existing_version
  FROM public.customers c
  WHERE c.tenant_id = v_tenant_id
    AND c.venue_id = v_venue_id
    AND c.customer_id = v_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Create path: version must be 1
    IF v_version <> 1 THEN
      RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT'
        USING ERRCODE = 'P0001',
              DETAIL = format('create requires version=1, received=%s', v_version);
    END IF;

    INSERT INTO public.customers (
      customer_id,
      customer_number,
      tenant_id,
      venue_id,
      customer_type,
      status,
      display_name,
      legal_name,
      locale,
      individual_profile,
      organization_profile,
      account_user_id,
      player_id,
      organization_id,
      classification,
      segment_references,
      tags,
      communication_preferences,
      consent_references,
      metadata,
      version,
      created_at,
      updated_at
    ) VALUES (
      v_customer_id,
      trim(p_customer ->> 'customer_number'),
      v_tenant_id,
      v_venue_id,
      trim(p_customer ->> 'customer_type'),
      trim(p_customer ->> 'status'),
      trim(p_customer ->> 'display_name'),
      nullif(trim(p_customer ->> 'legal_name'), ''),
      nullif(trim(p_customer ->> 'locale'), ''),
      coalesce(p_customer -> 'individual_profile', '{}'::jsonb),
      coalesce(p_customer -> 'organization_profile', '{}'::jsonb),
      nullif(trim(p_customer ->> 'account_user_id'), ''),
      nullif(trim(p_customer ->> 'player_id'), ''),
      nullif(trim(p_customer ->> 'organization_id'), ''),
      coalesce(p_customer -> 'classification', '[]'::jsonb),
      coalesce(p_customer -> 'segment_references', '[]'::jsonb),
      coalesce(p_customer -> 'tags', '[]'::jsonb),
      coalesce(p_customer -> 'communication_preferences', '[]'::jsonb),
      coalesce(p_customer -> 'consent_references', '[]'::jsonb),
      coalesce(p_customer -> 'metadata', '{}'::jsonb),
      v_version,
      (p_customer ->> 'created_at')::timestamptz,
      (p_customer ->> 'updated_at')::timestamptz
    );
  ELSE
    -- Update path: payload version must be exactly existing + 1
    v_expected_previous := v_version - 1;
    IF v_existing_version <> v_expected_previous THEN
      RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT'
        USING ERRCODE = 'P0001',
              DETAIL = format(
                'expected_previous=%s actual=%s received=%s',
                v_expected_previous,
                v_existing_version,
                v_version
              );
    END IF;

    UPDATE public.customers
    SET
      customer_number = trim(p_customer ->> 'customer_number'),
      customer_type = trim(p_customer ->> 'customer_type'),
      status = trim(p_customer ->> 'status'),
      display_name = trim(p_customer ->> 'display_name'),
      legal_name = nullif(trim(p_customer ->> 'legal_name'), ''),
      locale = nullif(trim(p_customer ->> 'locale'), ''),
      individual_profile = coalesce(p_customer -> 'individual_profile', '{}'::jsonb),
      organization_profile = coalesce(p_customer -> 'organization_profile', '{}'::jsonb),
      account_user_id = nullif(trim(p_customer ->> 'account_user_id'), ''),
      player_id = nullif(trim(p_customer ->> 'player_id'), ''),
      organization_id = nullif(trim(p_customer ->> 'organization_id'), ''),
      classification = coalesce(p_customer -> 'classification', '[]'::jsonb),
      segment_references = coalesce(p_customer -> 'segment_references', '[]'::jsonb),
      tags = coalesce(p_customer -> 'tags', '[]'::jsonb),
      communication_preferences = coalesce(p_customer -> 'communication_preferences', '[]'::jsonb),
      consent_references = coalesce(p_customer -> 'consent_references', '[]'::jsonb),
      metadata = coalesce(p_customer -> 'metadata', '{}'::jsonb),
      version = v_version,
      updated_at = (p_customer ->> 'updated_at')::timestamptz
    WHERE tenant_id = v_tenant_id
      AND venue_id = v_venue_id
      AND customer_id = v_customer_id
      AND version = v_expected_previous;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT'
        USING ERRCODE = 'P0001',
              DETAIL = 'concurrent update lost race';
    END IF;

    DELETE FROM public.customer_contact_points
    WHERE tenant_id = v_tenant_id
      AND venue_id = v_venue_id
      AND customer_id = v_customer_id;

    DELETE FROM public.customer_addresses
    WHERE tenant_id = v_tenant_id
      AND venue_id = v_venue_id
      AND customer_id = v_customer_id;
  END IF;

  FOR v_contact IN
    SELECT elem FROM jsonb_array_elements(p_contact_points) AS t(elem)
  LOOP
    INSERT INTO public.customer_contact_points (
      contact_point_id,
      customer_id,
      tenant_id,
      venue_id,
      contact_type,
      normalized_value,
      display_value,
      purpose,
      is_primary,
      verification_state,
      status,
      version,
      created_at,
      updated_at
    ) VALUES (
      trim(v_contact ->> 'contact_point_id'),
      v_customer_id,
      v_tenant_id,
      v_venue_id,
      trim(v_contact ->> 'contact_type'),
      trim(v_contact ->> 'normalized_value'),
      trim(v_contact ->> 'display_value'),
      coalesce(nullif(trim(v_contact ->> 'purpose'), ''), 'GENERAL'),
      coalesce((v_contact ->> 'is_primary')::boolean, false),
      coalesce(nullif(trim(v_contact ->> 'verification_state'), ''), 'UNVERIFIED'),
      coalesce(nullif(trim(v_contact ->> 'status'), ''), 'ACTIVE'),
      coalesce((v_contact ->> 'version')::integer, 1),
      (v_contact ->> 'created_at')::timestamptz,
      (v_contact ->> 'updated_at')::timestamptz
    );
  END LOOP;

  FOR v_address IN
    SELECT elem FROM jsonb_array_elements(p_addresses) AS t(elem)
  LOOP
    INSERT INTO public.customer_addresses (
      address_id,
      customer_id,
      tenant_id,
      venue_id,
      address_type,
      address_line1,
      address_line2,
      locality,
      admin_area,
      postal_code,
      country_code,
      is_primary,
      status,
      version,
      created_at,
      updated_at
    ) VALUES (
      trim(v_address ->> 'address_id'),
      v_customer_id,
      v_tenant_id,
      v_venue_id,
      trim(v_address ->> 'address_type'),
      trim(v_address ->> 'address_line1'),
      nullif(trim(v_address ->> 'address_line2'), ''),
      nullif(trim(v_address ->> 'locality'), ''),
      nullif(trim(v_address ->> 'admin_area'), ''),
      nullif(trim(v_address ->> 'postal_code'), ''),
      coalesce(nullif(trim(v_address ->> 'country_code'), ''), 'VN'),
      coalesce((v_address ->> 'is_primary')::boolean, false),
      coalesce(nullif(trim(v_address ->> 'status'), ''), 'ACTIVE'),
      coalesce((v_address ->> 'version')::integer, 1),
      (v_address ->> 'created_at')::timestamptz,
      (v_address ->> 'updated_at')::timestamptz
    );
  END LOOP;

  SELECT to_jsonb(c)
    INTO v_result
  FROM public.customers c
  WHERE c.tenant_id = v_tenant_id
    AND c.venue_id = v_venue_id
    AND c.customer_id = v_customer_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.customer_save_aggregate(jsonb, jsonb, jsonb) IS
  'CUSTOMER-03 atomic customer aggregate save with optimistic concurrency. Trusted service_role path only.';

REVOKE ALL ON FUNCTION public.customer_save_aggregate(jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_save_aggregate(jsonb, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.customer_save_aggregate(jsonb, jsonb, jsonb) FROM authenticated;
-- service_role EXECUTE granted in 50_CUSTOMER_PHASE_3_GRANTS.sql
