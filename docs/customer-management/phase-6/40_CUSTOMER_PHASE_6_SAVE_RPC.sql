-- =============================================================================
-- CUSTOMER-06 — Trusted RPCs (candidate/proposal save + execute merge)
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- service_role execute only. Authenticated/anon execute revoked.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.customer_save_duplicate_candidate(
  p_candidate jsonb,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text := trim(coalesce(p_candidate->>'candidate_id', ''));
  v_existing public.customer_duplicate_candidates%ROWTYPE;
BEGIN
  IF v_id = '' THEN
    RAISE EXCEPTION 'customer_save_duplicate_candidate: candidate_id required'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.customer_duplicate_candidates
  WHERE candidate_id = v_id
  FOR UPDATE;

  IF p_expected_version IS NOT NULL THEN
    IF NOT FOUND AND p_expected_version <> 0 THEN
      RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    IF FOUND AND v_existing.version <> p_expected_version THEN
      RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.customer_duplicate_candidates AS c (
    candidate_id, customer_id_a, customer_id_b, tenant_id, venue_id,
    classification, score, signals, conflicts, reason_codes, status,
    detected_at, evaluated_at, evaluated_versions, version, source,
    reviewed_at, review_reference, updated_at
  ) VALUES (
    v_id,
    p_candidate->>'customer_id_a',
    p_candidate->>'customer_id_b',
    p_candidate->>'tenant_id',
    p_candidate->>'venue_id',
    p_candidate->>'classification',
    nullif(p_candidate->>'score', '')::integer,
    coalesce(p_candidate->'signals', '[]'::jsonb),
    coalesce(p_candidate->'conflicts', '[]'::jsonb),
    coalesce(p_candidate->'reason_codes', '[]'::jsonb),
    p_candidate->>'status',
    (p_candidate->>'detected_at')::timestamptz,
    (p_candidate->>'evaluated_at')::timestamptz,
    coalesce(p_candidate->'evaluated_versions', '{}'::jsonb),
    coalesce((p_candidate->>'version')::integer, 1),
    coalesce(p_candidate->>'source', 'SYSTEM'),
    nullif(p_candidate->>'reviewed_at', '')::timestamptz,
    nullif(p_candidate->>'review_reference', ''),
    (p_candidate->>'updated_at')::timestamptz
  )
  ON CONFLICT (candidate_id) DO UPDATE SET
    classification = EXCLUDED.classification,
    score = EXCLUDED.score,
    signals = EXCLUDED.signals,
    conflicts = EXCLUDED.conflicts,
    reason_codes = EXCLUDED.reason_codes,
    status = EXCLUDED.status,
    evaluated_at = EXCLUDED.evaluated_at,
    evaluated_versions = EXCLUDED.evaluated_versions,
    version = EXCLUDED.version,
    source = EXCLUDED.source,
    reviewed_at = EXCLUDED.reviewed_at,
    review_reference = EXCLUDED.review_reference,
    updated_at = EXCLUDED.updated_at
  RETURNING to_jsonb(c.*) INTO p_candidate;

  RETURN p_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_save_merge_proposal(
  p_proposal jsonb,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text := trim(coalesce(p_proposal->>'merge_proposal_id', ''));
  v_existing public.customer_merge_proposals%ROWTYPE;
  v_out jsonb;
BEGIN
  IF v_id = '' THEN
    RAISE EXCEPTION 'customer_save_merge_proposal: merge_proposal_id required'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.customer_merge_proposals
  WHERE merge_proposal_id = v_id
  FOR UPDATE;

  IF p_expected_version IS NOT NULL THEN
    IF NOT FOUND AND p_expected_version <> 0 THEN
      RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    IF FOUND AND v_existing.version <> p_expected_version THEN
      RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.customer_merge_proposals AS p (
    merge_proposal_id, candidate_id, survivor_customer_id, absorbed_customer_id,
    tenant_id, venue_id, expected_survivor_version, expected_absorbed_version,
    profile_resolution, contact_resolution, address_resolution, consent_resolution,
    preference_resolution, linkage_resolution, conflicts, match_kinds,
    approval_status, approval_reference, approved_by, approved_at, status,
    created_at, updated_at, version
  ) VALUES (
    v_id,
    nullif(p_proposal->>'candidate_id', ''),
    p_proposal->>'survivor_customer_id',
    p_proposal->>'absorbed_customer_id',
    p_proposal->>'tenant_id',
    p_proposal->>'venue_id',
    nullif(p_proposal->>'expected_survivor_version', '')::integer,
    nullif(p_proposal->>'expected_absorbed_version', '')::integer,
    coalesce(p_proposal->'profile_resolution', '{}'::jsonb),
    coalesce(p_proposal->'contact_resolution', '{}'::jsonb),
    coalesce(p_proposal->'address_resolution', '{}'::jsonb),
    coalesce(p_proposal->'consent_resolution', '{}'::jsonb),
    coalesce(p_proposal->'preference_resolution', '{}'::jsonb),
    coalesce(p_proposal->'linkage_resolution', '{}'::jsonb),
    coalesce(p_proposal->'conflicts', '[]'::jsonb),
    coalesce(p_proposal->'match_kinds', '[]'::jsonb),
    p_proposal->>'approval_status',
    nullif(p_proposal->>'approval_reference', ''),
    nullif(p_proposal->>'approved_by', ''),
    nullif(p_proposal->>'approved_at', '')::timestamptz,
    p_proposal->>'status',
    (p_proposal->>'created_at')::timestamptz,
    (p_proposal->>'updated_at')::timestamptz,
    coalesce((p_proposal->>'version')::integer, 1)
  )
  ON CONFLICT (merge_proposal_id) DO UPDATE SET
    candidate_id = EXCLUDED.candidate_id,
    expected_survivor_version = EXCLUDED.expected_survivor_version,
    expected_absorbed_version = EXCLUDED.expected_absorbed_version,
    profile_resolution = EXCLUDED.profile_resolution,
    contact_resolution = EXCLUDED.contact_resolution,
    address_resolution = EXCLUDED.address_resolution,
    consent_resolution = EXCLUDED.consent_resolution,
    preference_resolution = EXCLUDED.preference_resolution,
    linkage_resolution = EXCLUDED.linkage_resolution,
    conflicts = EXCLUDED.conflicts,
    match_kinds = EXCLUDED.match_kinds,
    approval_status = EXCLUDED.approval_status,
    approval_reference = EXCLUDED.approval_reference,
    approved_by = EXCLUDED.approved_by,
    approved_at = EXCLUDED.approved_at,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at,
    version = EXCLUDED.version
  RETURNING to_jsonb(p.*) INTO v_out;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_execute_merge(
  p_survivor jsonb,
  p_survivor_contacts jsonb DEFAULT '[]'::jsonb,
  p_survivor_addresses jsonb DEFAULT '[]'::jsonb,
  p_absorbed jsonb DEFAULT '{}'::jsonb,
  p_history jsonb DEFAULT '{}'::jsonb,
  p_proposal jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_survivor_id text := trim(coalesce(p_survivor->>'customer_id', ''));
  v_absorbed_id text := trim(coalesce(p_absorbed->>'customer_id', ''));
  v_tenant text := trim(coalesce(p_survivor->>'tenant_id', ''));
  v_venue text := trim(coalesce(p_survivor->>'venue_id', ''));
  v_surv public.customers%ROWTYPE;
  v_abs public.customers%ROWTYPE;
  v_contact jsonb;
  v_address jsonb;
BEGIN
  IF v_survivor_id = '' OR v_absorbed_id = '' OR v_tenant = '' OR v_venue = '' THEN
    RAISE EXCEPTION 'customer_execute_merge: required identifiers missing'
      USING ERRCODE = '22023';
  END IF;

  IF coalesce(p_proposal->>'approval_reference', '') = '' THEN
    RAISE EXCEPTION 'MERGE_APPROVAL_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF coalesce(p_proposal->>'status', '') NOT IN ('APPROVED', 'COMPLETED') THEN
    RAISE EXCEPTION 'MERGE_PROPOSAL_NOT_APPROVED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_surv FROM public.customers
  WHERE customer_id = v_survivor_id AND tenant_id = v_tenant AND venue_id = v_venue
  FOR UPDATE;

  SELECT * INTO v_abs FROM public.customers
  WHERE customer_id = v_absorbed_id AND tenant_id = v_tenant AND venue_id = v_venue
  FOR UPDATE;

  IF NOT FOUND OR v_surv.customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_execute_merge: survivor missing' USING ERRCODE = '23503';
  END IF;

  IF v_surv.version <> coalesce((p_survivor->>'version')::integer, 0) - 1 THEN
    RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  IF v_abs.version <> coalesce((p_absorbed->>'version')::integer, 0) - 1 THEN
    RAISE EXCEPTION 'CUSTOMER_VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.customers SET
    display_name = p_survivor->>'display_name',
    legal_name = nullif(p_survivor->>'legal_name', ''),
    locale = nullif(p_survivor->>'locale', ''),
    individual_profile = coalesce(p_survivor->'individual_profile', '{}'::jsonb),
    organization_profile = coalesce(p_survivor->'organization_profile', '{}'::jsonb),
    version = (p_survivor->>'version')::integer,
    updated_at = (p_survivor->>'updated_at')::timestamptz
  WHERE customer_id = v_survivor_id AND tenant_id = v_tenant AND venue_id = v_venue;

  DELETE FROM public.customer_contact_points
  WHERE customer_id = v_survivor_id AND tenant_id = v_tenant AND venue_id = v_venue;

  FOR v_contact IN SELECT * FROM jsonb_array_elements(coalesce(p_survivor_contacts, '[]'::jsonb))
  LOOP
    INSERT INTO public.customer_contact_points (
      contact_point_id, customer_id, tenant_id, venue_id, contact_type,
      normalized_value, display_value, purpose, is_primary, verification_state,
      status, version, created_at, updated_at
    ) VALUES (
      v_contact->>'contact_point_id',
      v_survivor_id, v_tenant, v_venue,
      v_contact->>'contact_type',
      v_contact->>'normalized_value',
      v_contact->>'display_value',
      coalesce(v_contact->>'purpose', 'GENERAL'),
      coalesce((v_contact->>'is_primary')::boolean, false),
      coalesce(v_contact->>'verification_state', 'UNVERIFIED'),
      coalesce(v_contact->>'status', 'ACTIVE'),
      coalesce((v_contact->>'version')::integer, 1),
      (v_contact->>'created_at')::timestamptz,
      (v_contact->>'updated_at')::timestamptz
    );
  END LOOP;

  DELETE FROM public.customer_addresses
  WHERE customer_id = v_survivor_id AND tenant_id = v_tenant AND venue_id = v_venue;

  FOR v_address IN SELECT * FROM jsonb_array_elements(coalesce(p_survivor_addresses, '[]'::jsonb))
  LOOP
    INSERT INTO public.customer_addresses (
      address_id, customer_id, tenant_id, venue_id, address_type,
      address_line1, address_line2, locality, admin_area, postal_code,
      country_code, is_primary, status, version, created_at, updated_at
    ) VALUES (
      v_address->>'address_id',
      v_survivor_id, v_tenant, v_venue,
      v_address->>'address_type',
      v_address->>'address_line1',
      nullif(v_address->>'address_line2', ''),
      nullif(v_address->>'locality', ''),
      nullif(v_address->>'admin_area', ''),
      nullif(v_address->>'postal_code', ''),
      coalesce(v_address->>'country_code', 'VN'),
      coalesce((v_address->>'is_primary')::boolean, false),
      coalesce(v_address->>'status', 'ACTIVE'),
      coalesce((v_address->>'version')::integer, 1),
      (v_address->>'created_at')::timestamptz,
      (v_address->>'updated_at')::timestamptz
    );
  END LOOP;

  UPDATE public.customers SET
    status = 'MERGED',
    merged_into_customer_id = v_survivor_id,
    merged_at = (p_absorbed->>'merged_at')::timestamptz,
    merge_history_id = p_history->>'merge_history_id',
    merge_proposal_id = nullif(p_proposal->>'merge_proposal_id', ''),
    version = (p_absorbed->>'version')::integer,
    updated_at = (p_absorbed->>'updated_at')::timestamptz
  WHERE customer_id = v_absorbed_id AND tenant_id = v_tenant AND venue_id = v_venue;

  INSERT INTO public.customer_merge_history (
    merge_history_id, merge_proposal_id, candidate_id, survivor_customer_id,
    absorbed_customer_id, tenant_id, venue_id, approval_reference, actor_reference,
    survivor_version_after, absorbed_version_at_merge, resolution_summary,
    reason_codes, recorded_at
  ) VALUES (
    p_history->>'merge_history_id',
    nullif(p_history->>'merge_proposal_id', ''),
    nullif(p_history->>'candidate_id', ''),
    v_survivor_id,
    v_absorbed_id,
    v_tenant,
    v_venue,
    nullif(p_history->>'approval_reference', ''),
    nullif(p_history->>'actor_reference', ''),
    nullif(p_history->>'survivor_version_after', '')::integer,
    nullif(p_history->>'absorbed_version_at_merge', '')::integer,
    coalesce(p_history->'resolution_summary', '{}'::jsonb),
    coalesce(p_history->'reason_codes', '[]'::jsonb),
    (p_history->>'recorded_at')::timestamptz
  );

  PERFORM public.customer_save_merge_proposal(p_proposal || jsonb_build_object('status', 'COMPLETED'), NULL);

  RETURN jsonb_build_object(
    'survivor_customer_id', v_survivor_id,
    'absorbed_customer_id', v_absorbed_id,
    'merge_history_id', p_history->>'merge_history_id'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.customer_save_duplicate_candidate(jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_save_duplicate_candidate(jsonb, integer) FROM anon;
REVOKE ALL ON FUNCTION public.customer_save_duplicate_candidate(jsonb, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.customer_save_duplicate_candidate(jsonb, integer) TO service_role;

REVOKE ALL ON FUNCTION public.customer_save_merge_proposal(jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_save_merge_proposal(jsonb, integer) FROM anon;
REVOKE ALL ON FUNCTION public.customer_save_merge_proposal(jsonb, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.customer_save_merge_proposal(jsonb, integer) TO service_role;

REVOKE ALL ON FUNCTION public.customer_execute_merge(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_execute_merge(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.customer_execute_merge(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.customer_execute_merge(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) TO service_role;
