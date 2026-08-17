-- Court Operations legacy isolation 01 ROLLBACK.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
-- Restores inventory RPC to venue_id cluster filter (pre-Batch8 debt body).
-- Does NOT drop venue_id. Drops additive tenant_id only after restoring RPC.
BEGIN;

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
  v_courts jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED', 'courts', '[]'::jsonb);
  END IF;
  IF nullif(btrim(p_tenant_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH', 'courts', '[]'::jsonb);
  END IF;
  IF NOT (
    public.is_super_admin()
    OR p_tenant_id = public.user_venue_id()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_FORBIDDEN', 'courts', '[]'::jsonb);
  END IF;
  IF nullif(btrim(p_club_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_CLUB_ID', 'courts', '[]'::jsonb);
  END IF;

  SELECT c.tenant_id INTO v_club_tenant
  FROM public.clubs c
  WHERE c.id = btrim(p_club_id);
  IF v_club_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'OUT_OF_SCOPE', 'courts', '[]'::jsonb);
  END IF;
  IF v_club_tenant IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH', 'courts', '[]'::jsonb);
  END IF;

  IF nullif(btrim(p_cluster_id), '') IS NOT NULL THEN
    SELECT cc.venue_id INTO v_cluster_tenant
    FROM public.court_clusters cc
    WHERE cc.id = btrim(p_cluster_id);
    IF v_cluster_tenant IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'CLUSTER_MISMATCH', 'courts', '[]'::jsonb);
    END IF;
    IF v_cluster_tenant IS DISTINCT FROM p_tenant_id THEN
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
    WHERE pc.tenant_id = p_tenant_id
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

REVOKE ALL ON FUNCTION public.court_resource_list_eligible_courts(text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.court_resource_list_eligible_courts(text, text, text)
  TO authenticated;

DROP INDEX IF EXISTS public.court_clusters_tenant_venue_idx;
DROP INDEX IF EXISTS public.court_clusters_tenant_id_idx;

ALTER TABLE public.court_clusters
  DROP COLUMN IF EXISTS tenant_id;

COMMIT;
