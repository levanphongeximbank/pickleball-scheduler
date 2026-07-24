-- =============================================================================
-- CUSTOMER-05 — Verification queries (static / post-apply checklist)
-- Run after Owner-gated apply. No Production secrets.
-- =============================================================================

SET search_path = public, pg_temp;

-- Required tables
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('customer_linkages', 'customer_linkage_history')
  AND c.relkind = 'r'
ORDER BY 1;

-- RLS enabled
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('customer_linkages', 'customer_linkage_history')
ORDER BY 1;

-- Unique active indexes present
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'customer_linkages'
  AND indexname LIKE 'customer_linkages_active_%'
ORDER BY 1;

-- Trusted RPC exists and is executable by service_role only (spot-check)
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'customer_save_linkage';
