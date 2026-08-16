-- Court Resource canonical inventory read. READ-ONLY PRECHECK.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
-- Requires Phase 3A Court Master + Access tables. Does not require Phase 3B.

DO $$
DECLARE
  v_missing text[] := '{}';
BEGIN
  IF to_regclass('public.court_resource_physical_courts') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_physical_courts');
  END IF;
  IF to_regclass('public.court_resource_club_operational_access') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_club_operational_access');
  END IF;
  IF to_regclass('public.court_clusters') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_clusters');
  END IF;
  IF to_regclass('public.clubs') IS NULL THEN
    v_missing := array_append(v_missing, 'public.clubs');
  END IF;
  IF to_regprocedure('public.is_super_admin()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.is_super_admin()');
  END IF;
  IF to_regprocedure('public.user_venue_id()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.user_venue_id()');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL missing Court Master/Access objects: %',
      array_to_string(v_missing, ', ');
  END IF;

  IF to_regprocedure(
    'public.court_resource_list_eligible_courts(text,text,text)'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'PRECHECK_FAIL inventory read RPC already present — refuse re-apply drift';
  END IF;

  RAISE NOTICE 'PRECHECK_OK court_resource_canonical_inventory_read_01';
END
$$;

SELECT 'REMOTE_MUTATIONS' AS check_item, 0 AS value, true AS ok;
SELECT 'STAGING_APPLY' AS check_item, 'NO' AS value, true AS ok;
SELECT 'PRODUCTION_APPLY' AS check_item, 'NO' AS value, true AS ok;
