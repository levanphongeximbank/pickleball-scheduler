-- Phase 3A Option B precheck. READ ONLY. NOT APPLIED.
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.venues') IS NULL THEN
    v_missing := array_append(v_missing, 'public.venues');
  END IF;
  IF to_regclass('public.clubs') IS NULL THEN
    v_missing := array_append(v_missing, 'public.clubs');
  END IF;
  IF to_regclass('public.court_clusters') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_clusters');
  END IF;
  IF to_regprocedure('public.is_super_admin()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.is_super_admin()');
  END IF;
  IF to_regprocedure('public.user_venue_id()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.user_venue_id()');
  END IF;
  IF to_regprocedure('public.can_access_cluster(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.can_access_cluster(text)');
  END IF;
  IF to_regprocedure('public.phase42_has_gov_role(text,text[])') IS NULL THEN
    v_missing := array_append(v_missing, 'public.phase42_has_gov_role(text,text[])');
  END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL missing: %', array_to_string(v_missing, ', ');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'court_clusters'
      AND column_name = 'id' AND data_type = 'text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'court_clusters'
      AND column_name = 'venue_id' AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL court_clusters(id, venue_id) must be text';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clubs'
      AND column_name = 'id' AND data_type = 'text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clubs'
      AND column_name = 'tenant_id' AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL clubs(id, tenant_id) must be text';
  END IF;
END
$$;

SELECT 'PACKAGE_OBJECTS_PRESENT' AS check_item, count(*) AS value
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN (
  'court_resource_physical_courts',
  'court_resource_club_operational_access',
  'court_resource_cluster_identity_mappings',
  'court_resource_legacy_court_identity_mappings'
);
SELECT 'REMOTE_MUTATIONS' AS check_item, 0 AS value, true AS ok;
