-- Daily Play court capability canonical read-path 01 APPLY.
-- ADDITIVE function replace only. No court/club/player/tenant row writes.
-- SELECTED_STRATEGY=CANONICAL
-- Target: Staging qyewbxjsiiyufanzcjcq only.

BEGIN;

-- Court-owned canonical reader. Corrects Tenant/Venue authority:
--   profiles.tenant_id (explicit) — never venue-as-tenant helper fallback
--   court_clusters.tenant_id for cluster tenant proof — never venue_id as tenant invent
CREATE OR REPLACE FUNCTION public.court_resource_list_eligible_courts(
  p_tenant_id text,
  p_club_id text,
  p_cluster_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_club_tenant text;
  v_cluster_tenant text;
  v_actor_tenant text;
  v_courts jsonb := '[]'::jsonb;
BEGIN
  IF nullif(btrim(p_tenant_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH', 'courts', '[]'::jsonb);
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED', 'courts', '[]'::jsonb);
  END IF;

  -- Explicit Tenant authority. Do not COALESCE to venue_id.
  SELECT nullif(btrim(p.tenant_id), '')
  INTO v_actor_tenant
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF NOT (
    public.is_super_admin()
    OR (v_actor_tenant IS NOT NULL AND v_actor_tenant = btrim(p_tenant_id))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_FORBIDDEN', 'courts', '[]'::jsonb);
  END IF;

  IF nullif(btrim(p_club_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_CLUB_ID', 'courts', '[]'::jsonb);
  END IF;

  SELECT c.tenant_id INTO v_club_tenant
  FROM public.clubs c
  WHERE c.id = btrim(p_club_id)
    AND c.deleted_at IS NULL;
  IF v_club_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'OUT_OF_SCOPE', 'courts', '[]'::jsonb);
  END IF;
  IF v_club_tenant IS DISTINCT FROM btrim(p_tenant_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH', 'courts', '[]'::jsonb);
  END IF;

  IF nullif(btrim(p_cluster_id), '') IS NOT NULL THEN
    -- Cluster tenant proof is court_clusters.tenant_id, never venue_id.
    SELECT cc.tenant_id INTO v_cluster_tenant
    FROM public.court_clusters cc
    WHERE cc.id = btrim(p_cluster_id);
    IF v_cluster_tenant IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'CLUSTER_MISMATCH', 'courts', '[]'::jsonb);
    END IF;
    IF v_cluster_tenant IS DISTINCT FROM btrim(p_tenant_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH', 'courts', '[]'::jsonb);
    END IF;
  END IF;

  SELECT coalesce(jsonb_agg(row_data ORDER BY sort_order, display_name), '[]'::jsonb)
  INTO v_courts
  FROM (
    SELECT jsonb_build_object(
      'physicalCourtId', pc.physical_court_id,
      'clusterId', pc.cluster_id,
      'displayName', pc.display_name,
      'displayCode', pc.display_code,
      'displayNumber', pc.display_number,
      'status', pc.lifecycle_status,
      'sortOrder', pc.sort_order,
      'identityAuthority', 'physicalCourtId'
    ) AS row_data,
    pc.sort_order,
    pc.display_name
    FROM public.court_resource_physical_courts pc
    INNER JOIN public.court_resource_club_operational_access a
      ON a.physical_court_id = pc.physical_court_id
     AND a.tenant_id = pc.tenant_id
    WHERE pc.tenant_id = btrim(p_tenant_id)
      AND a.club_id = btrim(p_club_id)
      AND a.status = 'enabled'
      AND pc.lifecycle_status = 'active'
      AND (
        nullif(btrim(p_cluster_id), '') IS NULL
        OR pc.cluster_id = btrim(p_cluster_id)
      )
  ) eligible;

  RETURN jsonb_build_object('ok', true, 'code', 'OK', 'courts', v_courts);
END
$cr$;

COMMENT ON FUNCTION public.court_resource_list_eligible_courts(text, text, text) IS
  '2.2 Court Operations canonical eligible-court reader. Tenant=profiles.tenant_id or super admin. Cluster tenant=court_clusters.tenant_id. Never venue-as-tenant.';

REVOKE ALL ON FUNCTION public.court_resource_list_eligible_courts(text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.court_resource_list_eligible_courts(text, text, text)
  TO authenticated, service_role;

-- Daily thin consumer. Does not query court_resource_* tables or compatibility blobs.
-- Signature preserved for existing Daily create/assign/snapshot callers.
CREATE OR REPLACE FUNCTION public.daily_play_read_courts(
  p_club_id text,
  p_enabled_court_ids jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $dp$
DECLARE
  v_tenant text;
  v_listed jsonb;
  v_courts jsonb := '[]'::jsonb;
BEGIN
  IF nullif(btrim(coalesce(p_club_id, '')), '') IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT c.tenant_id
  INTO v_tenant
  FROM public.clubs c
  WHERE c.id = btrim(p_club_id)
    AND c.deleted_at IS NULL;
  IF nullif(btrim(coalesce(v_tenant, '')), '') IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  v_listed := public.court_resource_list_eligible_courts(
    v_tenant,
    btrim(p_club_id),
    NULL
  );

  IF v_listed IS NULL
     OR coalesce((v_listed->>'ok')::boolean, false) IS NOT TRUE
     OR jsonb_typeof(v_listed->'courts') IS DISTINCT FROM 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(
    jsonb_agg(projected.court ORDER BY projected.sort_order, projected.display_name),
    '[]'::jsonb
  )
  INTO v_courts
  FROM (
    SELECT jsonb_build_object(
      'physicalCourtId', c.court->>'physicalCourtId',
      'clusterId', c.court->>'clusterId',
      'displayName', c.court->>'displayName',
      'displayCode', c.court->>'displayCode',
      'displayNumber', c.court->>'displayNumber',
      'status', c.court->>'status',
      'sortOrder', c.court->'sortOrder',
      'identityAuthority', 'physicalCourtId',
      -- compatibility-only Daily lease/assign alias; not a second court identity
      'id', c.court->>'physicalCourtId',
      'courtId', c.court->>'physicalCourtId',
      'name', c.court->>'displayName',
      'compatibilityAlias', 'daily_storage_courtId_equals_physicalCourtId'
    ) AS court,
    coalesce(NULLIF(c.court->>'sortOrder', '')::integer, 0) AS sort_order,
    coalesce(c.court->>'displayName', '') AS display_name
    FROM jsonb_array_elements(v_listed->'courts') AS c(court)
    WHERE nullif(btrim(coalesce(c.court->>'physicalCourtId', '')), '') IS NOT NULL
      AND (
        p_enabled_court_ids IS NULL
        OR jsonb_typeof(p_enabled_court_ids) IS DISTINCT FROM 'array'
        OR jsonb_array_length(p_enabled_court_ids) = 0
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(p_enabled_court_ids) e(id)
          WHERE e.id IN (
            c.court->>'physicalCourtId',
            c.court->>'id',
            c.court->>'courtId'
          )
        )
      )
  ) projected;

  RETURN coalesce(v_courts, '[]'::jsonb);
END
$dp$;

COMMENT ON FUNCTION public.daily_play_read_courts(text, jsonb) IS
  'Daily Play thin court projection. Delegates eligibility to court_resource_list_eligible_courts. Does not own Court inventory.';

REVOKE ALL ON FUNCTION public.daily_play_read_courts(text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_read_courts(text, jsonb)
  TO service_role;

COMMIT;
