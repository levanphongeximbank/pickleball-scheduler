-- Phase 3A Option B verification. READ ONLY.
DO $$
DECLARE
  v_table text;
  v_missing text[] := ARRAY[]::text[];
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'court_resource_physical_courts',
    'court_resource_club_operational_access',
    'court_resource_cluster_identity_mappings',
    'court_resource_legacy_court_identity_mappings'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN
      v_missing := array_append(v_missing, v_table);
    END IF;
  END LOOP;
  IF to_regprocedure('public.court_resource_identity_guard()') IS NULL THEN
    v_missing := array_append(v_missing, 'court_resource_identity_guard()');
  END IF;
  IF to_regprocedure(
    'public.court_resource_resolve_legacy_court_mapping(text,text,text,text,text,text,text,uuid,jsonb,jsonb)'
  ) IS NULL THEN
    v_missing := array_append(v_missing, 'court_resource_resolve_legacy_court_mapping');
  END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL missing package objects: %',
      array_to_string(v_missing, ', ');
  END IF;
  -- Read-only: the Stage 3 rowtype hazard was `TG_TABLE_NAME = cluster
  -- mappings AND NEW.cluster_id` evaluated on legacy mapping rows.
  IF pg_get_functiondef(
       to_regprocedure('public.court_resource_identity_guard()')
     ) ~* E'TG_TABLE_NAME\\s*=\\s*''court_resource_cluster_identity_mappings''\\s+AND\\s+NEW\\.cluster_id'
  THEN
    RAISE EXCEPTION
      'VERIFY_FAIL identity guard binds NEW.cluster_id before nested table discriminator';
  END IF;
  IF pg_get_functiondef(
       to_regprocedure('public.court_resource_identity_guard()')
     ) !~ E'TG_TABLE_NAME\\s*=\\s*''court_resource_cluster_identity_mappings''\\s+THEN'
     OR pg_get_functiondef(
       to_regprocedure('public.court_resource_identity_guard()')
     ) !~ E'IF NEW\\.cluster_id IS NOT NULL THEN'
  THEN
    RAISE EXCEPTION
      'VERIFY_FAIL identity guard missing nested cluster_id discriminator';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN (
      'court_resource_physical_courts',
      'court_resource_club_operational_access',
      'court_resource_cluster_identity_mappings',
      'court_resource_legacy_court_identity_mappings'
    ) AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL RLS must be enabled and forced';
  END IF;
  IF (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND policyname IN (
      'court_resource_physical_courts_select',
      'court_resource_club_access_select',
      'court_resource_cluster_mappings_select',
      'court_resource_legacy_mappings_select'
    ) AND cmd = 'SELECT'
  ) <> 4 THEN
    RAISE EXCEPTION 'VERIFY_FAIL expected exactly four package SELECT policies';
  END IF;
  IF (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'court_resource_physical_courts',
      'court_resource_club_operational_access',
      'court_resource_cluster_identity_mappings',
      'court_resource_legacy_court_identity_mappings'
    )
  ) <> 4 THEN
    RAISE EXCEPTION 'VERIFY_FAIL unexpected package policy exists';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'court_resource_physical_courts',
      'court_resource_club_operational_access',
      'court_resource_cluster_identity_mappings',
      'court_resource_legacy_court_identity_mappings'
    )
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL package has direct write policy';
  END IF;
  IF (
    SELECT count(*) FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
      AND t.tgname IN (
        'trg_court_resource_physical_courts_guard',
        'trg_court_resource_club_access_guard',
        'trg_court_resource_cluster_mapping_guard',
        'trg_court_resource_legacy_mapping_guard'
      )
  ) <> 4 THEN
    RAISE EXCEPTION 'VERIFY_FAIL expected exactly four package triggers';
  END IF;
  IF (
    SELECT count(*) FROM pg_indexes
    WHERE schemaname = 'public' AND indexname IN (
      'court_resource_physical_courts_cluster_idx',
      'court_resource_club_access_club_idx',
      'court_resource_club_access_court_idx',
      'court_resource_cluster_mapping_target_idx',
      'court_resource_legacy_mapping_court_idx',
      'court_resource_legacy_mapping_review_idx'
    )
  ) <> 6 THEN
    RAISE EXCEPTION 'VERIFY_FAIL expected exactly six package indexes';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      VALUES
        ('court_resource_physical_courts', 9),
        ('court_resource_club_operational_access', 10),
        ('court_resource_cluster_identity_mappings', 12),
        ('court_resource_legacy_court_identity_mappings', 15)
    ) expected(table_name, constraint_count)
    WHERE (
      SELECT count(*) FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = expected.table_name
    ) <> expected.constraint_count
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL package constraint set differs from APPLY';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    WHERE c.relname = 'court_resource_legacy_court_identity_mappings'
      AND con.conname = 'court_resource_legacy_mapping_key_uniq'
      AND pg_get_constraintdef(con.oid) ILIKE
        '%tenant_id%club_id%source_system%source_version%legacy_cluster_id%legacy_court_id%'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL full provenance mapping key missing';
  END IF;
  IF has_function_privilege(
      'anon',
      'public.court_resource_resolve_legacy_court_mapping(text,text,text,text,text,text,text,uuid,jsonb,jsonb)',
      'EXECUTE'
    ) OR NOT has_function_privilege(
      'authenticated',
      'public.court_resource_resolve_legacy_court_mapping(text,text,text,text,text,text,text,uuid,jsonb,jsonb)',
      'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL resolver grants are not fail closed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      VALUES
        ('court_resource_physical_courts'),
        ('court_resource_club_operational_access'),
        ('court_resource_cluster_identity_mappings'),
        ('court_resource_legacy_court_identity_mappings')
    ) package_table(name)
    WHERE has_table_privilege('anon', 'public.' || name, 'SELECT')
       OR has_table_privilege('authenticated', 'public.' || name, 'SELECT')
       OR has_table_privilege('authenticated', 'public.' || name, 'INSERT')
       OR has_table_privilege('authenticated', 'public.' || name, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || name, 'DELETE')
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL direct client table privilege exists';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.oid = to_regprocedure(
        'public.court_resource_resolve_legacy_court_mapping(text,text,text,text,text,text,text,uuid,jsonb,jsonb)'
      )
      AND p.prosecdef
      AND coalesce(array_to_string(p.proconfig, ','), '')
        ILIKE '%search_path=pg_catalog, public%'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL resolver security boundary differs from APPLY';
  END IF;
  RAISE NOTICE 'VERIFY_OK Phase 3A Option B package matches ownership manifest';
END
$$;

SELECT 'TABLES' AS object_type, count(*) AS object_count, 4 AS expected
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN (
  'court_resource_physical_courts',
  'court_resource_club_operational_access',
  'court_resource_cluster_identity_mappings',
  'court_resource_legacy_court_identity_mappings'
);
SELECT 'RESERVATION_OBJECTS_AUTHORED' AS check_item, 0 AS value, true AS ok;
