-- =============================================================================
-- NEWS-04 — Public boundary verification (read-only)
-- Purpose: After Owner-authorized Staging apply of 10_NEWS_PHASE_04_*.sql
-- Status: AUTHORED. Do not run against Production.
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

-- Expect: definition ILIKE '%provenance = ''LIVE''%'
-- Expect: definition NOT ILIKE only '%provenance <> ''MOCK''%' without LIVE equality

-- Runtime contract smoke (should return 0 rows with non-LIVE provenance)
SELECT content_id, provenance, editorial_status, public_visibility
FROM public.news_public_content_query_public(now(), NULL, NULL, 200)
WHERE provenance IS DISTINCT FROM 'LIVE';
