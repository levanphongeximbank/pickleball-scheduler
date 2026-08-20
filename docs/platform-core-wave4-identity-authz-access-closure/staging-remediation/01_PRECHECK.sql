-- Wave 4 Staging remediation — 01_PRECHECK.sql
-- AUTHOR ONLY. READ-ONLY. DO NOT MUTATE.
-- SQL_EXECUTION_GO = NO unless Owner later authorizes this exact file.
-- Fail-closed classifications via RAISE EXCEPTION / result rows.

-- Required objects
DO $$
BEGIN
  IF to_regclass('public.tenant_members') IS NULL THEN
    RAISE EXCEPTION 'WAVE4_PRECHECK_FAIL: public.tenant_members missing';
  END IF;
  IF to_regclass('public.platform_tenants') IS NULL THEN
    RAISE EXCEPTION 'WAVE4_PRECHECK_FAIL: public.platform_tenants missing';
  END IF;
  IF to_regclass('public.venues') IS NULL THEN
    RAISE EXCEPTION 'WAVE4_PRECHECK_FAIL: public.venues missing';
  END IF;
END $$;

SELECT 'WAVE4_PRECHECK' AS check_name, 'OBJECTS_PRESENT' AS classification,
       'PASS' AS result,
       'tenant_members, platform_tenants, venues exist' AS detail;

-- Exact tenant_members columns / types
WITH expected(column_name, data_type, udt_name) AS (
  VALUES
    ('id', 'uuid', 'uuid'),
    ('tenant_id', 'text', 'text'),
    ('user_id', 'uuid', 'uuid'),
    ('role_code', 'text', 'text'),
    ('status', 'text', 'text'),
    ('version', 'integer', 'int4'),
    ('created_at', 'timestamp with time zone', 'timestamptz'),
    ('updated_at', 'timestamp with time zone', 'timestamptz')
),
actual AS (
  SELECT column_name, data_type, udt_name, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'tenant_members'
)
SELECT
  'WAVE4_PRECHECK' AS check_name,
  'COLUMN_SHAPE' AS classification,
  CASE
    WHEN e.column_name IS NULL THEN 'UNEXPECTED_COLUMN'
    WHEN a.column_name IS NULL THEN 'MISSING_REQUIRED_COLUMN'
    WHEN a.data_type IS DISTINCT FROM e.data_type THEN 'TYPE_MISMATCH'
    ELSE 'PASS'
  END AS result,
  COALESCE(e.column_name, a.column_name) AS column_name,
  a.data_type AS live_data_type,
  e.data_type AS expected_data_type
FROM expected e
FULL OUTER JOIN actual a ON a.column_name = e.column_name
ORDER BY 4;

DO $$
DECLARE
  missing int;
  mismatch int;
BEGIN
  SELECT count(*) INTO missing
  FROM (VALUES
    ('id'), ('tenant_id'), ('user_id'), ('role_code'),
    ('status'), ('version'), ('created_at'), ('updated_at')
  ) AS e(column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'tenant_members'
      AND c.column_name = e.column_name
  );
  IF missing > 0 THEN
    RAISE EXCEPTION 'WAVE4_PRECHECK_FAIL: tenant_members missing required columns (% )', missing;
  END IF;

  SELECT count(*) INTO mismatch
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'tenant_members'
    AND (
      (c.column_name = 'id' AND c.udt_name <> 'uuid')
      OR (c.column_name = 'tenant_id' AND c.udt_name <> 'text')
      OR (c.column_name = 'user_id' AND c.udt_name <> 'uuid')
      OR (c.column_name = 'role_code' AND c.udt_name <> 'text')
      OR (c.column_name = 'status' AND c.udt_name <> 'text')
      OR (c.column_name = 'version' AND c.udt_name NOT IN ('int4', 'int8'))
      OR (c.column_name = 'created_at' AND c.udt_name <> 'timestamptz')
      OR (c.column_name = 'updated_at' AND c.udt_name <> 'timestamptz')
    );
  IF mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE4_PRECHECK_FAIL: tenant_members column type mismatch count=%', mismatch;
  END IF;
END $$;

-- Current tenant_members.tenant_id FK target
SELECT
  'WAVE4_PRECHECK' AS check_name,
  'TENANT_MEMBERS_TENANT_FK' AS classification,
  n.nspname AS schema_name,
  c.conname,
  conf.relname AS fk_target_table,
  CASE
    WHEN conf.relname = 'venues' THEN 'LEGACY_VENUES_TARGET_EXPECTED_PRE_02'
    WHEN conf.relname = 'platform_tenants' THEN 'ALREADY_PLATFORM_TENANTS'
    WHEN conf.relname IS NULL THEN 'MISSING_TENANT_FK'
    ELSE 'UNKNOWN_FK_TARGET_FAIL_CLOSED'
  END AS result
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
LEFT JOIN pg_class conf ON conf.oid = c.confrelid
WHERE n.nspname = 'public'
  AND t.relname = 'tenant_members'
  AND c.contype = 'f'
  AND pg_get_constraintdef(c.oid) ILIKE '%tenant_id%';

-- Every tenant_members.tenant_id exists in platform_tenants
SELECT
  'WAVE4_PRECHECK' AS check_name,
  'ORPHAN_TENANT_VS_PLATFORM_TENANTS' AS classification,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL_ORPHAN_TENANT' END AS result,
  count(*) AS orphan_count
FROM public.tenant_members tm
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_tenants pt WHERE pt.id = tm.tenant_id
);

-- Historical compatibility: tenant_id may also exist in venues
SELECT
  'WAVE4_PRECHECK' AS check_name,
  'HISTORICAL_VENUE_ID_COMPAT' AS classification,
  count(*) FILTER (
    WHERE EXISTS (SELECT 1 FROM public.venues v WHERE v.id = tm.tenant_id)
  ) AS rows_also_in_venues,
  count(*) FILTER (
    WHERE NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.id = tm.tenant_id)
  ) AS rows_not_in_venues,
  'COMPATIBILITY_EVIDENCE_ONLY_DO_NOT_REWRITE' AS result
FROM public.tenant_members tm;

-- No orphan user
SELECT
  'WAVE4_PRECHECK' AS check_name,
  'ORPHAN_USER' AS classification,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL_ORPHAN_USER' END AS result,
  count(*) AS orphan_count
FROM public.tenant_members tm
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = tm.user_id
);

-- Duplicate active membership groups
SELECT
  'WAVE4_PRECHECK' AS check_name,
  'DUPLICATE_ACTIVE_MEMBERSHIPS' AS classification,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL_DUPLICATE_ACTIVE' END AS result,
  count(*) AS duplicate_groups
FROM (
  SELECT tenant_id, user_id
  FROM public.tenant_members
  WHERE status = 'active'
  GROUP BY tenant_id, user_id
  HAVING count(*) > 1
) d;

-- Unexpected role_code / status
SELECT
  'WAVE4_PRECHECK' AS check_name,
  'INVALID_ROLE_CODE' AS classification,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL_INVALID_ROLE_CODE' END AS result,
  count(*) AS n
FROM public.tenant_members
WHERE role_code NOT IN ('tenant_owner', 'tenant_staff');

SELECT
  'WAVE4_PRECHECK' AS check_name,
  'INVALID_STATUS' AS classification,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL_INVALID_STATUS' END AS result,
  count(*) AS n
FROM public.tenant_members
WHERE status NOT IN ('active', 'inactive');

-- RLS / FORCE RLS
SELECT
  'WAVE4_PRECHECK' AS check_name,
  'RLS_STATE' AS classification,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls,
  CASE
    WHEN c.relrowsecurity AND NOT c.relforcerowsecurity THEN 'PASS_RLS_ENABLED_FORCE_OFF'
    WHEN NOT c.relrowsecurity THEN 'FAIL_RLS_DISABLED'
    WHEN c.relforcerowsecurity THEN 'WARN_FORCE_RLS_ON_DO_NOT_CHANGE_HERE'
    ELSE 'UNCLASSIFIED'
  END AS result
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'tenant_members';

-- Policy inventory
SELECT
  'WAVE4_PRECHECK' AS check_name,
  'POLICY_INVENTORY' AS classification,
  pol.polname,
  pol.polcmd,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
  CASE
    WHEN pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%phase42_is_tenant_member%'
      THEN 'VENUE_AS_TENANT_OR_FOREIGN_MEMBER_READ_PRESENT'
    WHEN pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%venue_id%'
      THEN 'VENUE_AS_TENANT_POLICY_FALLBACK_PRESENT'
    WHEN pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%user_id = auth.uid()%'
      AND pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%phase42_is_platform_super_admin%'
      AND pg_get_expr(pol.polqual, pol.polrelid) NOT ILIKE '%phase42_is_tenant_member%'
      THEN 'ALREADY_CANONICAL_SELF_PLUS_SUPER_ADMIN'
    ELSE 'REVIEW_POLICY'
  END AS result
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'tenant_members'
ORDER BY pol.polname;

-- Table privilege inventory including TRUNCATE
SELECT
  'WAVE4_PRECHECK' AS check_name,
  'TABLE_PRIVILEGE' AS classification,
  grantee,
  privilege_type,
  CASE
    WHEN privilege_type = 'TRUNCATE' AND grantee IN ('anon', 'authenticated')
      THEN 'FAIL_TRUNCATE_GRANTED'
    WHEN privilege_type IN ('INSERT', 'UPDATE', 'DELETE') AND grantee IN ('anon', 'authenticated')
      THEN 'WARN_DML_GRANTED_REVIEW'
    ELSE 'INVENTORY'
  END AS result
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'tenant_members'
ORDER BY grantee, privilege_type;

-- Constraints / indexes
SELECT
  'WAVE4_PRECHECK' AS check_name,
  'CONSTRAINT_INVENTORY' AS classification,
  c.conname,
  c.contype,
  pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname = 'tenant_members'
ORDER BY c.contype, c.conname;

SELECT
  'WAVE4_PRECHECK' AS check_name,
  'INDEX_INVENTORY' AS classification,
  i.relname AS index_name,
  pg_get_indexdef(i.oid) AS def
FROM pg_index x
JOIN pg_class t ON t.oid = x.indrelid
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname = 'tenant_members'
ORDER BY i.relname;

-- phase42_is_tenant_member dependency inventory
SELECT
  'WAVE4_PRECHECK' AS check_name,
  'PHASE42_HELPER_DEPENDENCY' AS classification,
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  CASE
    WHEN p.prosrc ILIKE '%venue_id%' THEN 'VENUE_FALLBACK_PRESENT_DO_NOT_REPLACE_HERE'
    ELSE 'HELPER_PRESENT'
  END AS result
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'phase42_is_tenant_member';

SELECT
  'WAVE4_PRECHECK' AS check_name,
  'PHASE42_POLICY_CONSUMERS' AS classification,
  n.nspname AS table_schema,
  c.relname AS table_name,
  pol.polname,
  'LEAVE_HELPER_GLOBAL_RETIREMENT_DEFERRED' AS result
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%phase42_is_tenant_member%'
ORDER BY 2, 3, 4;

-- Identity RPC metadata (no mutation)
SELECT
  'WAVE4_PRECHECK' AS check_name,
  'IDENTITY_RPC_METADATA' AS classification,
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  CASE
    WHEN p.proname IN ('identity_list_users', 'identity_admin_update_user')
      THEN 'EXISTS_LEGACY_VENUE_SCOPED_GAP_OPEN'
    ELSE 'INVENTORY'
  END AS result
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('identity_list_users', 'identity_admin_update_user')
ORDER BY p.proname;

-- user_tenant_id() compatibility remains active; do not modify
SELECT
  'WAVE4_PRECHECK' AS check_name,
  'USER_TENANT_ID_COMPAT' AS classification,
  p.proname,
  CASE
    WHEN p.prosrc ILIKE '%COALESCE%' AND p.prosrc ILIKE '%venue_id%'
      THEN 'ACTIVE_EXPECTED'
    WHEN to_regprocedure('public.user_tenant_id()') IS NULL
      THEN 'MISSING_UNEXPECTED'
    ELSE 'REVIEW_DEFINITION'
  END AS result
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'user_tenant_id';

SELECT 'WAVE4_PRECHECK' AS check_name, 'READ_ONLY_COMPLETE' AS classification, 'PASS' AS result;
