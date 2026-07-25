-- =============================================================================
-- PM-ID-01 — Rollback (PM-ID-01 objects only)
-- AUTHORED ONLY — do not run without Owner authorization.
-- Does not drop clubs/profiles/membership/coaching objects.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.player_identity_admin_revoke_link(text, text, uuid, bigint);
DROP FUNCTION IF EXISTS public.player_identity_admin_upsert_link(text, text, uuid, text, text, text, bigint);
DROP FUNCTION IF EXISTS public.player_identity_admin_can_manage(text, text);
DROP FUNCTION IF EXISTS public.player_identity_is_mapped(text, text);
DROP FUNCTION IF EXISTS public.player_identity_resolve_mapping(text, text);

DROP TRIGGER IF EXISTS trg_player_identity_links_enforce_club_tenant
  ON public.player_identity_links;
DROP FUNCTION IF EXISTS public.player_identity_links_enforce_club_tenant();

DROP TABLE IF EXISTS public.player_identity_links;

COMMIT;
