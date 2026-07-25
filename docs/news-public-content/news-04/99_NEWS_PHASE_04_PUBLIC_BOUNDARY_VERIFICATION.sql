-- =============================================================================
-- NEWS-04 — Public boundary verification (read-only)
-- Purpose: After Owner-authorized Staging apply of 10_NEWS_PHASE_04_*.sql
-- Status: AUTHORED. Do not run against Production.
-- Note: query_public RETURNS TABLE does not include editorial_status/public_visibility.
-- =============================================================================

SET search_path = public, pg_temp;

-- Function body must require LIVE provenance (not merely exclude MOCK)
SELECT
  p.proname,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'news_public_content_query_public';

-- Runtime contract smoke (should return 0 rows with non-LIVE provenance)
SELECT content_id, provenance
FROM public.news_public_content_query_public(now(), NULL, NULL, 200)
WHERE provenance IS DISTINCT FROM 'LIVE';

-- Public window index must be LIVE-only
SELECT i.relname AS indexname, pg_get_indexdef(i.oid) AS indexdef
FROM pg_class t
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_index x ON x.indrelid = t.oid
JOIN pg_class i ON i.oid = x.indexrelid
WHERE n.nspname = 'public'
  AND t.relname = 'news_public_content_items'
  AND i.relname = 'news_public_content_items_public_window_idx';
