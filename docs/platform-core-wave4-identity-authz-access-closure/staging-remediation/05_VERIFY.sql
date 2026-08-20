-- Wave 4 Staging remediation — 05_VERIFY.sql
-- AUTHOR ONLY. READ-ONLY verification after a future apply.
-- SQL_EXECUTION_GO = NO
-- Do not require every active profile to have tenant_members.

SELECT
  'TENANT_MEMBERS_TENANT_FK_TARGET' AS check_name,
  conf.relname AS value,
  CASE WHEN conf.relname = 'platform_tenants' THEN 'PASS' ELSE 'FAIL' END AS result
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_class conf ON conf.oid = c.confrelid
WHERE n.nspname = 'public'
  AND t.relname = 'tenant_members'
  AND c.contype = 'f'
  AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (tenant_id)%';

SELECT
  'TENANT_MEMBERS_ORPHAN_TENANT' AS check_name,
  count(*) AS value,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM public.tenant_members tm
WHERE NOT EXISTS (SELECT 1 FROM public.platform_tenants pt WHERE pt.id = tm.tenant_id);

SELECT
  'TENANT_MEMBERS_ORPHAN_USER' AS check_name,
  count(*) AS value,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM public.tenant_members tm
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = tm.user_id);

SELECT
  'DUPLICATE_ACTIVE_MEMBERSHIPS' AS check_name,
  count(*) AS value,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM (
  SELECT tenant_id, user_id
  FROM public.tenant_members
  WHERE status = 'active'
  GROUP BY tenant_id, user_id
  HAVING count(*) > 1
) d;

SELECT
  'INVALID_ROLE_CODE' AS check_name,
  count(*) AS value,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM public.tenant_members
WHERE role_code NOT IN ('tenant_owner', 'tenant_staff');

SELECT
  'INVALID_STATUS' AS check_name,
  count(*) AS value,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM public.tenant_members
WHERE status NOT IN ('active', 'inactive');

SELECT
  'TENANT_MEMBERS_RLS_ENABLED' AS check_name,
  CASE WHEN c.relrowsecurity THEN 'YES' ELSE 'NO' END AS value,
  CASE WHEN c.relrowsecurity THEN 'PASS' ELSE 'FAIL' END AS result
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'tenant_members';

SELECT
  'TENANT_MEMBERS_FORCE_RLS' AS check_name,
  CASE WHEN c.relforcerowsecurity THEN 'YES' ELSE 'NO' END AS value,
  CASE WHEN NOT c.relforcerowsecurity THEN 'PASS' ELSE 'FAIL_UNEXPECTED_FORCE' END AS result
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'tenant_members';

SELECT
  'TENANT_MEMBERS_POLICY_MODEL' AS check_name,
  string_agg(pol.polname || ':' || coalesce(pg_get_expr(pol.polqual, pol.polrelid), ''), ' | ') AS value,
  CASE
    WHEN bool_or(pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%phase42_is_tenant_member%')
      OR bool_or(pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%venue_id%')
      THEN 'FAIL_VENUE_AS_TENANT_POLICY_FALLBACK'
    WHEN bool_and(
      pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%phase42_is_platform_super_admin%'
      AND pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%user_id = auth.uid()%'
    ) THEN 'CANONICAL_SELF_PLUS_SUPER_ADMIN'
    ELSE 'FAIL_UNEXPECTED_POLICY'
  END AS result
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'tenant_members'
  AND pol.polcmd = 'r';

SELECT
  'VENUE_AS_TENANT_POLICY_FALLBACK' AS check_name,
  CASE
    WHEN exists (
      SELECT 1
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'tenant_members'
        AND (
          pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%phase42_is_tenant_member%'
          OR pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%venue_id%'
        )
    ) THEN 'YES'
    ELSE 'NO'
  END AS value,
  CASE
    WHEN exists (
      SELECT 1
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'tenant_members'
        AND (
          pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%phase42_is_tenant_member%'
          OR pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%venue_id%'
        )
    ) THEN 'FAIL'
    ELSE 'PASS'
  END AS result;

SELECT
  'ANON_TRUNCATE_PRIVILEGE' AS check_name,
  CASE WHEN exists (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'tenant_members'
      AND grantee = 'anon' AND privilege_type = 'TRUNCATE'
  ) THEN 'YES' ELSE 'NO' END AS value,
  CASE WHEN exists (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'tenant_members'
      AND grantee = 'anon' AND privilege_type = 'TRUNCATE'
  ) THEN 'FAIL' ELSE 'PASS' END AS result;

SELECT
  'AUTHENTICATED_TRUNCATE_PRIVILEGE' AS check_name,
  CASE WHEN exists (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'tenant_members'
      AND grantee = 'authenticated' AND privilege_type = 'TRUNCATE'
  ) THEN 'YES' ELSE 'NO' END AS value,
  CASE WHEN exists (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'tenant_members'
      AND grantee = 'authenticated' AND privilege_type = 'TRUNCATE'
  ) THEN 'FAIL' ELSE 'PASS' END AS result;

SELECT
  'USER_TENANT_ID_DB_COMPATIBILITY_FALLBACK' AS check_name,
  CASE
    WHEN p.prosrc ILIKE '%COALESCE%' AND p.prosrc ILIKE '%venue_id%' THEN 'ACTIVE_EXPECTED'
    ELSE 'UNEXPECTED'
  END AS value,
  CASE
    WHEN p.prosrc ILIKE '%COALESCE%' AND p.prosrc ILIKE '%venue_id%' THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'user_tenant_id';

-- Architecture-amended: do not count Players as a failure.
SELECT
  'ACTIVE_TENANT_OPERATIONAL_ACTORS_WITHOUT_EXPLICIT_MEMBERSHIP' AS check_name,
  count(*) AS value,
  'OWNER_DECISION_REQUIRED_NOT_A_PACKAGE_FAILURE' AS result
FROM public.profiles p
WHERE coalesce(p.status, '') = 'active'
  AND upper(coalesce(p.role, '')) IN (
    'TENANT_OWNER', 'VENUE_OWNER', 'COURT_OWNER',
    'VENUE_MANAGER', 'COURT_MANAGER', 'CASHIER', 'STAFF',
    'TOURNAMENT_MANAGER', 'ACCOUNTANT'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.user_id = p.id AND tm.status = 'active'
  );

SELECT
  'IDENTITY_RPC_CANONICAL_SCOPE_GAP' AS check_name,
  'OPEN' AS value,
  'NOT_REMEDIATED_THIS_BATCH' AS result;
