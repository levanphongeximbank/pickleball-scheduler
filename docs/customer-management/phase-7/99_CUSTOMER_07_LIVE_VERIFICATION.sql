-- =============================================================================
-- CUSTOMER-07 — Live verification (read-only checks)
-- Run on Staging after CUSTOMER-03 → 06 apply. No DML. No Production.
-- =============================================================================

SET search_path = public, pg_temp;

-- Expected root tables
SELECT 'customers' AS object_name, to_regclass('public.customers') IS NOT NULL AS present
UNION ALL SELECT 'customer_contact_points', to_regclass('public.customer_contact_points') IS NOT NULL
UNION ALL SELECT 'customer_addresses', to_regclass('public.customer_addresses') IS NOT NULL
UNION ALL SELECT 'customer_consents', to_regclass('public.customer_consents') IS NOT NULL
UNION ALL SELECT 'customer_consent_history', to_regclass('public.customer_consent_history') IS NOT NULL
UNION ALL SELECT 'customer_communication_preferences', to_regclass('public.customer_communication_preferences') IS NOT NULL
UNION ALL SELECT 'customer_preference_history', to_regclass('public.customer_preference_history') IS NOT NULL
UNION ALL SELECT 'customer_linkages', to_regclass('public.customer_linkages') IS NOT NULL
UNION ALL SELECT 'customer_linkage_history', to_regclass('public.customer_linkage_history') IS NOT NULL
UNION ALL SELECT 'customer_duplicate_candidates', to_regclass('public.customer_duplicate_candidates') IS NOT NULL
UNION ALL SELECT 'customer_merge_proposals', to_regclass('public.customer_merge_proposals') IS NOT NULL
UNION ALL SELECT 'customer_merge_history', to_regclass('public.customer_merge_history') IS NOT NULL;

-- RLS enabled
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname LIKE 'customer%'
ORDER BY c.relname;

-- No USING (true) policies on customer tables
SELECT pol.polname, cls.relname, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr
FROM pg_policy pol
JOIN pg_class cls ON cls.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = cls.relnamespace
WHERE n.nspname = 'public'
  AND cls.relname LIKE 'customer%'
  AND pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%true%';

-- Trusted RPCs present
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'customer_%'
ORDER BY p.proname;
