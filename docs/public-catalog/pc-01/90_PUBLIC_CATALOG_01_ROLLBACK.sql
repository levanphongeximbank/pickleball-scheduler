-- =============================================================================
-- PUBLIC-CATALOG-01 — Rollback (authored only; NOT auto-applied)
-- =============================================================================

SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.public_catalog_list_courts(integer, integer, text, text);
DROP FUNCTION IF EXISTS public.public_catalog_list_clubs(integer, integer, text);

DROP TABLE IF EXISTS public.public_catalog_courts;

DROP INDEX IF EXISTS public.clubs_public_listed_idx;

ALTER TABLE public.clubs DROP COLUMN IF EXISTS public_contact;
ALTER TABLE public.clubs DROP COLUMN IF EXISTS public_cover_image_url;
ALTER TABLE public.clubs DROP COLUMN IF EXISTS public_logo_url;
ALTER TABLE public.clubs DROP COLUMN IF EXISTS public_location_summary;
ALTER TABLE public.clubs DROP COLUMN IF EXISTS public_slug;
ALTER TABLE public.clubs DROP COLUMN IF EXISTS is_publicly_listed;
