-- =============================================================================
-- PM-ID-01 — Constraints and indexes
-- Depends on: 10_PM_ID_01_MAPPING_TABLE.sql
-- AUTHORED ONLY — Owner GO required for Staging apply.
-- =============================================================================

BEGIN;

-- Cross-tenant / cross-club guard: club must belong to declared tenant.
CREATE OR REPLACE FUNCTION public.player_identity_links_enforce_club_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_club_tenant text;
BEGIN
  IF NEW.tenant_id IS NULL OR length(trim(NEW.tenant_id)) = 0 THEN
    RAISE EXCEPTION 'player_identity_links: tenant_id required';
  END IF;
  IF NEW.club_id IS NULL OR length(trim(NEW.club_id)) = 0 THEN
    RAISE EXCEPTION 'player_identity_links: club_id required';
  END IF;
  IF NEW.player_id IS NULL OR length(trim(NEW.player_id)) = 0 THEN
    RAISE EXCEPTION 'player_identity_links: player_id required';
  END IF;

  NEW.tenant_id := trim(NEW.tenant_id);
  NEW.club_id := trim(NEW.club_id);
  NEW.player_id := trim(NEW.player_id);
  NEW.provenance := trim(NEW.provenance);

  SELECT c.tenant_id INTO v_club_tenant
  FROM public.clubs c
  WHERE c.id = NEW.club_id;

  IF v_club_tenant IS NULL THEN
    RAISE EXCEPTION 'player_identity_links: club_id not found';
  END IF;

  IF v_club_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'player_identity_links: cross-tenant club reference denied';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.player_identity_links_enforce_club_tenant() IS
  'PM-ID-01 trigger: deny cross-tenant club references; normalize text keys.';

DROP TRIGGER IF EXISTS trg_player_identity_links_enforce_club_tenant
  ON public.player_identity_links;

CREATE TRIGGER trg_player_identity_links_enforce_club_tenant
  BEFORE INSERT OR UPDATE ON public.player_identity_links
  FOR EACH ROW
  EXECUTE FUNCTION public.player_identity_links_enforce_club_tenant();

-- Invariant 1: one ACTIVE mapping per tenant+club+principal
CREATE UNIQUE INDEX IF NOT EXISTS uq_player_identity_links_active_principal
  ON public.player_identity_links (tenant_id, club_id, principal_id)
  WHERE status = 'ACTIVE';

-- Invariant 2: one ACTIVE mapping per tenant+club+player
CREATE UNIQUE INDEX IF NOT EXISTS uq_player_identity_links_active_player
  ON public.player_identity_links (tenant_id, club_id, player_id)
  WHERE status = 'ACTIVE';

-- Read helpers
CREATE INDEX IF NOT EXISTS idx_player_identity_links_principal_scope
  ON public.player_identity_links (tenant_id, club_id, principal_id, status);

CREATE INDEX IF NOT EXISTS idx_player_identity_links_player_scope
  ON public.player_identity_links (tenant_id, club_id, player_id, status);

COMMIT;
