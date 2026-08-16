-- Court Resource canonical owner-reservation read. ADDITIVE. LOCAL AUTHORING ONLY.
-- NOT APPLIED TO STAGING OR PRODUCTION.
BEGIN;

CREATE FUNCTION public.court_resource_list_owner_reservations(
  p_tenant_id text,
  p_club_id text,
  p_owner_type text,
  p_owner_id text,
  p_physical_court_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_club_tenant text;
  v_owner_type text;
  v_ids uuid[];
  v_id uuid;
  v_court_tenant text;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'UNAUTHENTICATED', 'reservations', '[]'::jsonb
    );
  END IF;
  IF nullif(btrim(p_tenant_id), '') IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'TENANT_MISMATCH', 'reservations', '[]'::jsonb
    );
  END IF;
  IF NOT (
    public.is_super_admin()
    OR p_tenant_id = public.user_venue_id()
  ) THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'TENANT_FORBIDDEN', 'reservations', '[]'::jsonb
    );
  END IF;
  IF nullif(btrim(p_club_id), '') IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'MISSING_CLUB_ID', 'reservations', '[]'::jsonb
    );
  END IF;

  SELECT c.tenant_id INTO v_club_tenant
  FROM public.clubs c
  WHERE c.id = btrim(p_club_id);
  IF v_club_tenant IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'OUT_OF_SCOPE', 'reservations', '[]'::jsonb
    );
  END IF;
  IF v_club_tenant IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'TENANT_MISMATCH', 'reservations', '[]'::jsonb
    );
  END IF;

  v_owner_type := public.court_resource_map_gateway_owner_type(p_owner_type);
  IF v_owner_type IS NULL OR nullif(btrim(p_owner_id), '') IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'MISSING_OWNER', 'reservations', '[]'::jsonb
    );
  END IF;

  v_ids := public.court_resource_reservation_normalize_court_ids(p_physical_court_ids);
  IF p_physical_court_ids IS NOT NULL AND cardinality(v_ids) > 0 THEN
    FOREACH v_id IN ARRAY v_ids LOOP
      SELECT tenant_id INTO v_court_tenant
      FROM public.court_resource_physical_courts
      WHERE physical_court_id = v_id;
      IF v_court_tenant IS NULL THEN
        RETURN jsonb_build_object(
          'ok', false,
          'code', 'UNKNOWN_COURT',
          'physicalCourtId', v_id,
          'reservations', '[]'::jsonb
        );
      END IF;
      IF v_court_tenant IS DISTINCT FROM p_tenant_id THEN
        RETURN jsonb_build_object(
          'ok', false,
          'code', 'CROSS_TENANT_COURT',
          'physicalCourtId', v_id,
          'reservations', '[]'::jsonb
        );
      END IF;
    END LOOP;
  END IF;

  SELECT coalesce(jsonb_agg(row_data ORDER BY starts_at, physical_court_id), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'reservationId', r.reservation_id,
      'physicalCourtId', r.physical_court_id,
      'clubId', r.club_id,
      'ownerType', r.owner_type,
      'ownerId', r.owner_id,
      'startsAt', r.starts_at,
      'endsAt', r.ends_at,
      'status', r.status,
      'requestId', r.request_id,
      'identityAuthority', 'physicalCourtId'
    ) AS row_data,
    r.starts_at,
    r.physical_court_id
    FROM public.court_resource_reservations r
    WHERE r.tenant_id = p_tenant_id
      AND r.club_id = btrim(p_club_id)
      AND r.owner_type = v_owner_type
      AND r.owner_id = btrim(p_owner_id)
      AND r.status = 'active'
      AND (
        cardinality(v_ids) = 0
        OR r.physical_court_id = ANY (v_ids)
      )
  ) owned;

  RETURN jsonb_build_object('ok', true, 'code', 'OK', 'reservations', v_rows);
END
$cr$;

REVOKE ALL ON FUNCTION public.court_resource_list_owner_reservations(text, text, text, text, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.court_resource_list_owner_reservations(text, text, text, text, uuid[])
  TO authenticated;

COMMIT;
