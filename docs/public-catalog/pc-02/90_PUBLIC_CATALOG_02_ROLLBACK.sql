-- =============================================================================
-- PUBLIC-CATALOG-02 — Rollback (authored only; NOT auto-applied)
-- Drops PC-02 projection objects only. Never drops Clubs/Courts PC-01,
-- vpr_leaderboard, competition tables, or club_data_v3.
-- =============================================================================

SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.public_catalog_list_rankings(integer, integer, text, text);
DROP FUNCTION IF EXISTS public.public_catalog_list_tournaments(integer, integer, text);

DROP TABLE IF EXISTS public.public_catalog_rankings;
DROP TABLE IF EXISTS public.public_catalog_tournaments;
