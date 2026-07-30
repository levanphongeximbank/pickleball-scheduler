-- Court cluster admin RPC staging verify (READ-ONLY)
-- Target: qyewbxjsiiyufanzcjcq only. Do not run mutations here.

SELECT
  to_regclass('public.court_clusters') IS NOT NULL AS court_clusters_exists,
  to_regclass('public.court_claim_requests') IS NOT NULL AS court_claim_requests_exists;

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  pg_get_function_result(p.oid) AS result_type,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'can_review_court_claim',
    'court_admin_upsert_cluster',
    'court_admin_remove_cluster_owner',
    'court_admin_delete_cluster',
    'court_list_registerable_clusters'
  )
ORDER BY p.proname, identity_args;

-- Expect exact upsert identity: p_cluster json
SELECT
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'court_admin_upsert_cluster'
      AND pg_get_function_identity_arguments(p.oid) = 'p_cluster json'
  ) AS upsert_signature_ok;

SELECT
  r.routine_name,
  r.grantee,
  r.privilege_type
FROM information_schema.routine_privileges r
WHERE r.routine_schema = 'public'
  AND r.routine_name IN (
    'court_admin_upsert_cluster',
    'court_list_registerable_clusters',
    'can_review_court_claim'
  )
  AND r.grantee IN ('authenticated', 'anon', 'public')
ORDER BY r.routine_name, r.grantee;
