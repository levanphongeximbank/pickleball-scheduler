-- Daily Play court capability canonical read-path 01 ROLLBACK.
-- Restores pre-package function bodies only.
-- Never deletes court, club, player, profile, or tenant rows.

BEGIN;

DO $$
DECLARE
  v_court_def text;
  v_daily_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_court_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'court_resource_list_eligible_courts'
    AND pg_get_function_identity_arguments(p.oid)
      = 'p_tenant_id text, p_club_id text, p_cluster_id text';

  SELECT pg_get_functiondef(p.oid) INTO v_daily_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'daily_play_read_courts'
    AND pg_get_function_identity_arguments(p.oid)
      = 'p_club_id text, p_enabled_court_ids jsonb';

  IF v_court_def IS NULL OR v_daily_def IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK_FAIL missing target functions — fail closed';
  END IF;

  IF v_daily_def NOT ILIKE '%court_resource_list_eligible_courts%'
     OR v_court_def ILIKE '%user_venue_id%' THEN
    RAISE EXCEPTION
      'ROLLBACK_FAIL current functions are not this workstream APPLY state — fail closed';
  END IF;
END
$$;

-- Restore Batch-8 / legacy-isolation Court reader (pre-this-workstream Staging body).
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
  TO authenticated, service_role;

-- Restore pre-package Daily blob reader (flat data.courts only).
CREATE OR REPLACE FUNCTION public.daily_play_read_courts(
  p_club_id text, p_enabled_court_ids jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(c.court ORDER BY c.ord), '[]'::jsonb)
  FROM public.club_data_v3 d
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(d.data->'courts') = 'array'
      THEN d.data->'courts' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS c(court, ord)
  WHERE d.club_id = p_club_id
    AND nullif(trim(coalesce(c.court->>'id', c.court->>'courtId', '')), '') IS NOT NULL
    AND lower(coalesce(c.court->>'active', 'true')) NOT IN ('false', '0', 'no')
    AND lower(coalesce(c.court->>'status', 'active')) NOT IN ('locked', 'maintenance')
    AND (
      p_enabled_court_ids IS NULL
      OR jsonb_typeof(p_enabled_court_ids) IS DISTINCT FROM 'array'
      OR jsonb_array_length(p_enabled_court_ids) = 0
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(p_enabled_court_ids) e(id)
        WHERE e.id = coalesce(c.court->>'id', c.court->>'courtId')
      )
    )
$$;

REVOKE ALL ON FUNCTION public.daily_play_read_courts(text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_read_courts(text, jsonb)
  TO service_role;

COMMIT;

SELECT 'ROLLBACK_SCOPE' AS check_item, 'court_resource_list_eligible_courts,daily_play_read_courts' AS value, true AS ok;
SELECT 'COURT_ROWS_DELETED' AS check_item, 0 AS value, true AS ok;
SELECT 'CLUB_ROWS_DELETED' AS check_item, 0 AS value, true AS ok;
