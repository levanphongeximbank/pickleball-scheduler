-- =============================================================================
-- NEWS-02 — Post-apply verification queries (NEWS-03)
-- Purpose: Run AFTER Owner-authorized apply on Staging. Not run in NEWS-02.
-- Status: AUTHORED ONLY.
-- =============================================================================

SET search_path = public, pg_temp;

-- Tables present
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname LIKE 'news_public_content_%'
ORDER BY c.relname;

-- RLS enabled + forced
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname LIKE 'news_public_content_%'
ORDER BY c.relname;

-- Policies (expect SELECT-only authenticated; no anon on base tables)
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename LIKE 'news_public_content_%'
ORDER BY tablename, policyname;

-- Functions
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'news_%'
ORDER BY p.proname;

-- Dangerous pattern spot-check (should return 0 rows for USING true)
SELECT tablename, policyname, qual
FROM pg_policies
WHERE tablename LIKE 'news_public_content_%'
  AND (
    qual ILIKE '%true%'
    OR with_check ILIKE '%true%'
  );
