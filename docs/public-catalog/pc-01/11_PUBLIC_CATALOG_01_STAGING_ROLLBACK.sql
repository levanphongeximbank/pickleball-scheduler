-- =============================================================================
-- PUBLIC-CATALOG-01S — Staging rollback package
-- Purpose:
--   Reverse PUBLIC-CATALOG-01 public-read RPC objects on Staging only.
-- Safety:
--   - Does NOT drop base public.clubs / venue courts business tables
--   - Does NOT delete club/court business rows
--   - Does NOT target Production
-- Use when: Staging apply or verification leaves an unsafe state.
-- Do NOT run if activation verification PASS.
-- =============================================================================

SET search_path = public, pg_temp;

-- 1) Revoke anon/authenticated EXECUTE (idempotent)
REVOKE ALL ON FUNCTION public.public_catalog_list_courts(integer, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_catalog_list_courts(integer, integer, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.public_catalog_list_courts(integer, integer, text, text) FROM authenticated;

REVOKE ALL ON FUNCTION public.public_catalog_list_clubs(integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_catalog_list_clubs(integer, integer, text) FROM anon;
REVOKE ALL ON FUNCTION public.public_catalog_list_clubs(integer, integer, text) FROM authenticated;

-- 2) Drop RPCs (exact signatures created by PC-01)
DROP FUNCTION IF EXISTS public.public_catalog_list_courts(integer, integer, text, text);
DROP FUNCTION IF EXISTS public.public_catalog_list_clubs(integer, integer, text);

-- 3) Drop projection objects created by PC-01 only
DROP TABLE IF EXISTS public.public_catalog_courts;

-- 4) Drop listing index created by PC-01
DROP INDEX IF EXISTS public.clubs_public_listed_idx;

-- 5) Drop opt-in public columns added by PC-01 (no business payload required)
ALTER TABLE public.clubs DROP COLUMN IF EXISTS public_contact;
ALTER TABLE public.clubs DROP COLUMN IF EXISTS public_cover_image_url;
ALTER TABLE public.clubs DROP COLUMN IF EXISTS public_logo_url;
ALTER TABLE public.clubs DROP COLUMN IF EXISTS public_location_summary;
ALTER TABLE public.clubs DROP COLUMN IF EXISTS public_slug;
ALTER TABLE public.clubs DROP COLUMN IF EXISTS is_publicly_listed;

-- =============================================================================
-- Post-rollback verification (expect all false / missing)
-- =============================================================================
-- SELECT EXISTS (
--   SELECT 1 FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'public_catalog_list_clubs'
-- ) AS clubs_rpc_exists; -- expect false
--
-- SELECT EXISTS (
--   SELECT 1 FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'public_catalog_list_courts'
-- ) AS courts_rpc_exists; -- expect false
--
-- SELECT EXISTS (
--   SELECT 1 FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name = 'public_catalog_courts'
-- ) AS projection_exists; -- expect false
--
-- SELECT EXISTS (
--   SELECT 1 FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'clubs' AND column_name = 'is_publicly_listed'
-- ) AS listed_col_exists; -- expect false
