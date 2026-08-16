-- Court Operations legacy isolation 01 VERIFY.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
DO $$
DECLARE
  v_errors text[] := '{}';
  v_unresolved integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'court_clusters'
      AND column_name = 'tenant_id'
      AND data_type = 'text'
      AND is_nullable = 'NO'
  ) THEN
    v_errors := array_append(v_errors, 'court_clusters.tenant_id missing or nullable');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'court_clusters'
      AND column_name = 'venue_id'
      AND data_type = 'text'
      AND is_nullable = 'NO'
  ) THEN
    v_errors := array_append(v_errors, 'court_clusters.venue_id missing');
  END IF;

  SELECT COUNT(*) INTO v_unresolved
  FROM public.court_clusters
  WHERE nullif(btrim(tenant_id), '') IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.id = court_clusters.venue_id);

  IF v_unresolved > 0 THEN
    v_errors := array_append(
      v_errors,
      format('unresolved cluster tenant/venue mapping count=%s', v_unresolved)
    );
  END IF;

  IF to_regprocedure('public.court_resource_list_eligible_courts(text,text,text)') IS NULL THEN
    v_errors := array_append(v_errors, 'court_resource_list_eligible_courts missing');
  END IF;

  -- Function body must reference cc.tenant_id (not venue_id as tenant invent).
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'court_resource_list_eligible_courts'
      AND pg_get_functiondef(p.oid) ILIKE '%cc.tenant_id%'
  ) THEN
    v_errors := array_append(
      v_errors,
      'court_resource_list_eligible_courts must filter cluster by tenant_id'
    );
  END IF;

  IF cardinality(v_errors) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: %', array_to_string(v_errors, '; ');
  END IF;

  RAISE NOTICE 'VERIFY_OK court-operations-legacy-isolation-01';
END $$;
