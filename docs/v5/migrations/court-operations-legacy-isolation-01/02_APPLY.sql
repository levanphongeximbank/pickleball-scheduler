-- Court Operations legacy isolation 01. ADDITIVE. LOCAL AUTHORING ONLY.
-- NOT APPLIED TO STAGING OR PRODUCTION.
-- LEGACY_ISOLATION_MIGRATION_VERSION=20260816220000
--
-- Target semantics:
--   court_clusters.tenant_id  = Platform canonical tenant/org scope
--   court_clusters.venue_id   = 2.1 Venue Management identity
--
-- Backfill rule (provable only):
--   tenant_id := venue_id WHERE venues.id = court_clusters.venue_id
-- Historical product stored org scope in venue_id (venues-as-tenant).
-- Unresolved rows FAIL CLOSED — no guessed venue mappings.
BEGIN;

ALTER TABLE public.court_clusters
  ADD COLUMN IF NOT EXISTS tenant_id text;

COMMENT ON COLUMN public.court_clusters.tenant_id IS
  'Platform/org tenant scope. Explicit. Not interchangeable with venue_id on canonical API.';
COMMENT ON COLUMN public.court_clusters.venue_id IS
  '2.1 Venue Management facility venue identity. Not organization_parent invent for callers.';

-- Provable backfill: venue FK already guarantees venues.id exists for every row.
UPDATE public.court_clusters cc
SET tenant_id = cc.venue_id
WHERE nullif(btrim(cc.tenant_id), '') IS NULL
  AND EXISTS (
    SELECT 1 FROM public.venues v WHERE v.id = cc.venue_id
  );

DO $$
DECLARE
  v_unresolved integer;
BEGIN
  SELECT COUNT(*) INTO v_unresolved
  FROM public.court_clusters
  WHERE nullif(btrim(tenant_id), '') IS NULL;

  IF v_unresolved > 0 THEN
    RAISE EXCEPTION
      'APPLY_FAIL UNRESOLVED_CLUSTER_TENANT_MAPPING count=% — fail closed, no fabrication',
      v_unresolved;
  END IF;
END $$;

ALTER TABLE public.court_clusters
  ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS court_clusters_tenant_id_idx
  ON public.court_clusters (tenant_id);

CREATE INDEX IF NOT EXISTS court_clusters_tenant_venue_idx
  ON public.court_clusters (tenant_id, venue_id);

-- Canonical inventory RPC: use explicit tenant_id for cluster tenant filter.
-- Does not edit certified package files; replaces function body additively.
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
    SELECT cc.tenant_id INTO v_cluster_tenant
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

COMMIT;
