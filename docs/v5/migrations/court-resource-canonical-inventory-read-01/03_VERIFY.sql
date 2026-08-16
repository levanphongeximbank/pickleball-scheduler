-- Court Resource canonical inventory read VERIFY.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.

DO $$
BEGIN
  IF to_regprocedure(
    'public.court_resource_list_eligible_courts(text,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL missing court_resource_list_eligible_courts';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.oid = to_regprocedure(
        'public.court_resource_list_eligible_courts(text,text,text)'
      )
      AND p.prosecdef
      AND coalesce(array_to_string(p.proconfig, ','), '')
        ILIKE '%search_path=pg_catalog, public%'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL inventory RPC security boundary differs from APPLY';
  END IF;

  IF has_table_privilege('anon', 'public.court_resource_physical_courts', 'SELECT')
     OR has_table_privilege('authenticated', 'public.court_resource_physical_courts', 'SELECT')
     OR has_table_privilege('anon', 'public.court_resource_club_operational_access', 'SELECT')
     OR has_table_privilege('authenticated', 'public.court_resource_club_operational_access', 'SELECT')
  THEN
    RAISE EXCEPTION 'VERIFY_FAIL direct client table privilege exists';
  END IF;

  IF has_function_privilege(
       'anon',
       'public.court_resource_list_eligible_courts(text,text,text)',
       'EXECUTE'
     )
     OR NOT has_function_privilege(
       'authenticated',
       'public.court_resource_list_eligible_courts(text,text,text)',
       'EXECUTE'
     )
  THEN
    RAISE EXCEPTION 'VERIFY_FAIL execute grant must be authenticated-only';
  END IF;

  RAISE NOTICE 'VERIFY_OK court_resource_canonical_inventory_read_01';
END
$$;

SELECT 'STAGING_APPLY' AS check_item, 'NO' AS value, true AS ok;
SELECT 'PRODUCTION_APPLY' AS check_item, 'NO' AS value, true AS ok;
