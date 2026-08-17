-- Court Resource canonical owner-reservation read. READ-ONLY PRECHECK.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
-- Requires Phase 3B reservation table. Does not edit Phase 3B SQL.

DO $$
DECLARE
  v_missing text[] := '{}';
BEGIN
  IF to_regclass('public.court_resource_reservations') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_reservations');
  END IF;
  IF to_regclass('public.court_resource_physical_courts') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_physical_courts');
  END IF;
  IF to_regclass('public.court_resource_club_operational_access') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_club_operational_access');
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
  IF to_regprocedure('public.court_resource_map_gateway_owner_type(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_map_gateway_owner_type(text)');
  END IF;
  IF to_regprocedure('public.court_resource_reservation_normalize_court_ids(uuid[])') IS NULL THEN
    v_missing := array_append(
      v_missing,
      'public.court_resource_reservation_normalize_court_ids(uuid[])'
    );
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL missing reservation/access objects: %',
      array_to_string(v_missing, ', ');
  END IF;

  IF to_regprocedure(
    'public.court_resource_list_owner_reservations(text,text,text,text,uuid[])'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'PRECHECK_FAIL owner-reservation read RPC already present — refuse re-apply drift';
  END IF;

  RAISE NOTICE 'PRECHECK_OK court_resource_canonical_owner_reservation_read_01';
END
$$;

SELECT 'REMOTE_MUTATIONS' AS check_item, 0 AS value, true AS ok;
SELECT 'STAGING_APPLY' AS check_item, 'NO' AS value, true AS ok;
SELECT 'PRODUCTION_APPLY' AS check_item, 'NO' AS value, true AS ok;
