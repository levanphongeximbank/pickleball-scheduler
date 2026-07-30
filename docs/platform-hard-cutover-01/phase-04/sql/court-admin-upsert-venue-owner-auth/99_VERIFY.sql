-- Read-only verify for venue-owner upsert auth remediation.
-- TARGET ONLY: qyewbxjsiiyufanzcjcq

SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS result_type,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'court_admin_upsert_cluster'
ORDER BY args;

SELECT
  position('user_venue_id' in pg_get_functiondef(p.oid)) > 0 AS has_venue_scope_check,
  position('TENANT_OWNER' in pg_get_functiondef(p.oid)) > 0 AS allows_tenant_owner_alias,
  position('can_review_court_claim' in pg_get_functiondef(p.oid)) > 0 AS keeps_platform_path
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'court_admin_upsert_cluster'
  AND pg_get_function_identity_arguments(p.oid) = 'p_cluster json';

-- Expect cluster.manage grants remain platform-only (no owner widen)
SELECT rp.role_id, rp.permission_id
FROM public.role_permissions rp
WHERE rp.permission_id = 'cluster.manage'
ORDER BY rp.role_id;
