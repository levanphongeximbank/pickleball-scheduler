-- Court Operations pre-Staging identity-guard correction 01 VERIFY.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
DO $$
DECLARE
  v_errors text[] := '{}';
  v_def text;
BEGIN
  IF to_regprocedure('public.court_resource_identity_guard()') IS NULL THEN
    v_errors := array_append(v_errors, 'court_resource_identity_guard() missing');
  ELSE
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'court_resource_identity_guard'
      AND pg_get_function_identity_arguments(p.oid) = '';

    IF v_def IS NULL OR v_def NOT ILIKE '%cc.tenant_id%' THEN
      v_errors := array_append(
        v_errors,
        'identity_guard must SELECT court_clusters.tenant_id (cc.tenant_id)'
      );
    END IF;

    -- Must not still invent tenant from cluster venue_id.
    IF v_def ILIKE '%SELECT venue_id INTO v_scope_tenant FROM public.court_clusters%'
       OR v_def ILIKE '%SELECT cc.venue_id INTO v_scope_tenant%' THEN
      v_errors := array_append(
        v_errors,
        'identity_guard must NOT compare physical tenant against cluster.venue_id'
      );
    END IF;

    IF v_def NOT ILIKE '%COURT_RESOURCE_UNKNOWN_CLUSTER%' THEN
      v_errors := array_append(
        v_errors,
        'identity_guard must fail closed on unknown cluster'
      );
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'court_resource_physical_courts'
      AND t.tgname = 'trg_court_resource_physical_courts_guard'
      AND NOT t.tgisinternal
      AND p.proname = 'court_resource_identity_guard'
  ) THEN
    v_errors := array_append(
      v_errors,
      'trg_court_resource_physical_courts_guard binding missing'
    );
  END IF;

  IF cardinality(v_errors) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: %', array_to_string(v_errors, '; ');
  END IF;

  RAISE NOTICE 'VERIFY_OK court-operations-pre-staging-identity-guard-01';
END $$;
