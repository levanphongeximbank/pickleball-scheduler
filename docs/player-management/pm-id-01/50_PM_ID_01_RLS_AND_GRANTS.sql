-- =============================================================================
-- PM-ID-01 — RLS and grants
-- Depends on: 10_*, 20_*, 30_*, 40_*
-- AUTHORED ONLY — Owner GO required for Staging apply.
-- No USING (true). No anon. REVOKE FROM PUBLIC.
-- =============================================================================

BEGIN;

ALTER TABLE public.player_identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_identity_links FORCE ROW LEVEL SECURITY;

-- Intentionally no permissive authenticated SELECT/INSERT/UPDATE/DELETE policies.
-- Clients resolve via SECURITY DEFINER helpers only.
-- Deny-by-default under RLS with zero policies for authenticated.

REVOKE ALL ON TABLE public.player_identity_links FROM PUBLIC;
REVOKE ALL ON TABLE public.player_identity_links FROM anon;
REVOKE ALL ON TABLE public.player_identity_links FROM authenticated;

-- Resolve helpers: authenticated execute only
REVOKE ALL ON FUNCTION public.player_identity_resolve_mapping(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.player_identity_resolve_mapping(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.player_identity_resolve_mapping(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.player_identity_is_mapped(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.player_identity_is_mapped(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.player_identity_is_mapped(text, text) TO authenticated;

-- Admin gate + RPCs: authenticated execute; authorization inside function
REVOKE ALL ON FUNCTION public.player_identity_admin_can_manage(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.player_identity_admin_can_manage(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.player_identity_admin_can_manage(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.player_identity_admin_upsert_link(text, text, uuid, text, text, text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.player_identity_admin_upsert_link(text, text, uuid, text, text, text, bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.player_identity_admin_upsert_link(text, text, uuid, text, text, text, bigint) TO authenticated;

REVOKE ALL ON FUNCTION public.player_identity_admin_revoke_link(text, text, uuid, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.player_identity_admin_revoke_link(text, text, uuid, bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.player_identity_admin_revoke_link(text, text, uuid, bigint) TO authenticated;

-- Trigger function: not for client execute
REVOKE ALL ON FUNCTION public.player_identity_links_enforce_club_tenant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.player_identity_links_enforce_club_tenant() FROM anon;
REVOKE ALL ON FUNCTION public.player_identity_links_enforce_club_tenant() FROM authenticated;

COMMIT;
