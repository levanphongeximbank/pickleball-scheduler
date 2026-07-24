-- =============================================================================
-- CUSTOMER-03 — Verification SQL (post-apply checklist queries)
-- Purpose: Read-only checks after Staging apply. Safe to run repeatedly.
-- Status: AUTHORED — not a migration. Does not mutate data.
-- =============================================================================

SET search_path = public, pg_temp;

-- Required tables exist
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN ('customers', 'customer_contact_points', 'customer_addresses')
ORDER BY 1;

-- RLS enabled + forced
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('customers', 'customer_contact_points', 'customer_addresses')
ORDER BY 1;

-- Policies present (SELECT only expected for authenticated)
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('customers', 'customer_contact_points', 'customer_addresses')
ORDER BY tablename, policyname;

-- Partial unique indexes
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'customers_tenant_venue_customer_number_uq',
    'customer_contact_points_active_normalized_uq',
    'customer_contact_points_primary_email_uq',
    'customer_contact_points_primary_phone_uq',
    'customer_addresses_primary_active_uq'
  )
ORDER BY 1;

-- Save RPC exists and execute privileges
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'customer_save_aggregate';

SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'customer_save_aggregate'
ORDER BY grantee, privilege_type;

-- No anon table privileges
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('customers', 'customer_contact_points', 'customer_addresses')
  AND grantee = 'anon';
