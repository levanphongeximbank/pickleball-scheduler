-- Court Operations canonical resource blocks 01. READ-ONLY PRECHECK.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
-- RESOURCE_BLOCKS_MIGRATION_VERSION=20260816180000
-- Requires Phase 3B reservation authority. Batch 3 booking package is optional.
-- Does not edit Phase 3A / Phase 3B / D4 / Batch1 / Batch2 / Batch3 SQL.

DO $$
DECLARE
  v_missing text[] := '{}';
  v_conflict text[] := '{}';
BEGIN
  -- Base identity / tenancy tables.
  IF to_regclass('public.venues') IS NULL THEN
    v_missing := array_append(v_missing, 'public.venues');
  END IF;
  IF to_regclass('public.clubs') IS NULL THEN
    v_missing := array_append(v_missing, 'public.clubs');
  END IF;

  -- Phase 3A canonical inventory identity.
  IF to_regclass('public.court_resource_physical_courts') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_physical_courts');
  END IF;
  IF to_regclass('public.court_resource_club_operational_access') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_club_operational_access');
  END IF;
  IF to_regclass('public.court_resource_legacy_court_identity_mappings') IS NULL THEN
    v_missing := array_append(
      v_missing, 'public.court_resource_legacy_court_identity_mappings'
    );
  END IF;

  -- Phase 3B capacity SSOT.
  IF to_regclass('public.court_resource_reservations') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_reservations');
  END IF;
  IF to_regclass('public.court_resource_reservation_commands') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_reservation_commands');
  END IF;

  -- Tenancy predicates.
  IF to_regprocedure('public.is_super_admin()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.is_super_admin()');
  END IF;
  IF to_regprocedure('public.user_venue_id()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.user_venue_id()');
  END IF;

  -- Phase 3B helpers this package reuses. Must exist unchanged.
  IF to_regprocedure(
    'public.court_resource_reserve_core('
    || 'text,text,uuid[],text,text,text,timestamptz,timestamptz,text,uuid)'
  ) IS NULL THEN
    v_missing := array_append(
      v_missing,
      'public.court_resource_reserve_core('
      || 'text,text,uuid[],text,text,text,timestamptz,timestamptz,text,uuid)'
    );
  END IF;
  IF to_regprocedure(
    'public.court_resource_reservation_assert_access(text,text,uuid[])'
  ) IS NULL THEN
    v_missing := array_append(
      v_missing, 'public.court_resource_reservation_assert_access(text,text,uuid[])'
    );
  END IF;
  IF to_regprocedure(
    'public.court_resource_reservation_normalize_court_ids(uuid[])'
  ) IS NULL THEN
    v_missing := array_append(
      v_missing, 'public.court_resource_reservation_normalize_court_ids(uuid[])'
    );
  END IF;
  IF to_regprocedure('public.court_resource_digest_sha256(bytea)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_digest_sha256(bytea)');
  END IF;
  IF to_regprocedure('public.court_resource_map_gateway_owner_type(text)') IS NULL THEN
    v_missing := array_append(
      v_missing, 'public.court_resource_map_gateway_owner_type(text)'
    );
  END IF;

  -- Batch 1 canonical inventory read.
  IF to_regprocedure(
    'public.court_resource_list_eligible_courts(text,text,text)'
  ) IS NULL THEN
    v_missing := array_append(
      v_missing, 'public.court_resource_list_eligible_courts(text,text,text)'
    );
  END IF;

  -- Batch 2 canonical owner-reservation read.
  IF to_regprocedure(
    'public.court_resource_list_owner_reservations(text,text,text,text,uuid[])'
  ) IS NULL THEN
    v_missing := array_append(
      v_missing,
      'public.court_resource_list_owner_reservations(text,text,text,text,uuid[])'
    );
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL missing required prerequisite objects: %',
      array_to_string(v_missing, ', ');
  END IF;

  -- Owner-type vocabulary must already accept maintenance and operations.
  -- Do NOT invent a court_resource_block owner type.
  IF public.court_resource_map_gateway_owner_type('maintenance')
       IS DISTINCT FROM 'maintenance' THEN
    RAISE EXCEPTION
      'PRECHECK_FAIL court_resource_map_gateway_owner_type does not map maintenance owner';
  END IF;
  IF public.court_resource_map_gateway_owner_type('operations')
       IS DISTINCT FROM 'operations' THEN
    RAISE EXCEPTION
      'PRECHECK_FAIL court_resource_map_gateway_owner_type does not map operations owner';
  END IF;

  -- Refuse re-apply drift: this package must not already exist.
  -- Batch 3 booking objects may coexist; they are not a conflict.
  IF to_regclass('public.court_operations_resource_blocks') IS NOT NULL THEN
    v_conflict := array_append(v_conflict, 'public.court_operations_resource_blocks');
  END IF;
  IF to_regclass('public.court_operations_resource_block_commands') IS NOT NULL THEN
    v_conflict := array_append(
      v_conflict, 'public.court_operations_resource_block_commands'
    );
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'court_operations_resource_block%'
  ) THEN
    v_conflict := array_append(
      v_conflict, 'public.court_operations_resource_block*() functions'
    );
  END IF;

  IF cardinality(v_conflict) > 0 THEN
    RAISE EXCEPTION
      'PRECHECK_FAIL resource block objects already present — refuse re-apply drift: %',
      array_to_string(v_conflict, ', ');
  END IF;

  RAISE NOTICE 'PRECHECK_OK court_resource_canonical_resource_blocks_01';
END
$$;

SELECT 'REMOTE_MUTATIONS' AS check_item, 0 AS value, true AS ok;
SELECT 'CAPACITY_SSOT' AS check_item, 'court_resource_reservations' AS value, true AS ok;
SELECT 'STAGING_APPLY' AS check_item, 'NO' AS value, true AS ok;
SELECT 'PRODUCTION_APPLY' AS check_item, 'NO' AS value, true AS ok;
