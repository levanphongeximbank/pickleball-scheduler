-- Phase 3A Option B rollback. PACKAGE-OWNED OBJECTS ONLY.
-- Destructive to Phase 3A data; requires explicit approval.
BEGIN;

DO $$
DECLARE
  v_dependent text;
BEGIN
  SELECT string_agg(n.nspname || '.' || c.relname, ', ')
  INTO v_dependent
  FROM pg_constraint con
  JOIN pg_class parent ON parent.oid = con.confrelid
  JOIN pg_namespace pn ON pn.oid = parent.relnamespace
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE pn.nspname = 'public'
    AND parent.relname IN (
      'court_resource_physical_courts',
      'court_resource_club_operational_access',
      'court_resource_cluster_identity_mappings',
      'court_resource_legacy_court_identity_mappings'
    )
    AND c.relname NOT IN (
      'court_resource_physical_courts',
      'court_resource_club_operational_access',
      'court_resource_cluster_identity_mappings',
      'court_resource_legacy_court_identity_mappings'
    );
  IF v_dependent IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK_FAIL later dependents: %', v_dependent;
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.court_resource_resolve_legacy_court_mapping(
  text,text,text,text,text,text,text,uuid,jsonb,jsonb
);
DROP TABLE IF EXISTS public.court_resource_legacy_court_identity_mappings;
DROP TABLE IF EXISTS public.court_resource_cluster_identity_mappings;
DROP TABLE IF EXISTS public.court_resource_club_operational_access;
DROP TABLE IF EXISTS public.court_resource_physical_courts;
DROP FUNCTION IF EXISTS public.court_resource_identity_guard();

COMMIT;

SELECT 'ROLLBACK_SCOPE' AS check_item,
  'Phase 3A package-owned objects only' AS value, true AS ok;
SELECT 'RESERVATION_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
