-- =============================================================================
-- PM-ID-01 — Mapping table (additive)
-- Table: public.player_identity_links
-- Status: AUTHORED ONLY — do not apply without Owner GO:
--         PM_ID_01_OWNER_GO_APPLY_STAGING
-- player_id type: text (canonical Player Management type; NOT uuid)
-- principal_id type: uuid (auth.users.id / profiles.id)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.player_identity_links (
  link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  principal_id uuid NOT NULL,
  player_id text NOT NULL,
  status text NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  provenance text NOT NULL,
  source_system text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  revoked_by uuid NULL,
  CONSTRAINT player_identity_links_status_chk
    CHECK (status IN ('ACTIVE', 'REVOKED')),
  CONSTRAINT player_identity_links_player_id_nonempty_chk
    CHECK (length(trim(player_id)) > 0),
  CONSTRAINT player_identity_links_tenant_nonempty_chk
    CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT player_identity_links_club_nonempty_chk
    CHECK (length(trim(club_id)) > 0),
  CONSTRAINT player_identity_links_provenance_nonempty_chk
    CHECK (length(trim(provenance)) > 0),
  CONSTRAINT player_identity_links_version_positive_chk
    CHECK (version >= 1),
  CONSTRAINT player_identity_links_revoke_consistency_chk
    CHECK (
      (status = 'ACTIVE' AND revoked_at IS NULL AND revoked_by IS NULL)
      OR
      (status = 'REVOKED' AND revoked_at IS NOT NULL)
    ),
  CONSTRAINT player_identity_links_principal_fk
    FOREIGN KEY (principal_id) REFERENCES auth.users (id),
  CONSTRAINT player_identity_links_created_by_fk
    FOREIGN KEY (created_by) REFERENCES auth.users (id),
  CONSTRAINT player_identity_links_revoked_by_fk
    FOREIGN KEY (revoked_by) REFERENCES auth.users (id),
  CONSTRAINT player_identity_links_club_fk
    FOREIGN KEY (club_id) REFERENCES public.clubs (id),
  CONSTRAINT player_identity_links_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.venues (id)
);

COMMENT ON TABLE public.player_identity_links IS
  'PM-ID-01 Player-owned canonical principal↔player mapping. ACTIVE unique per tenant/club×principal and tenant/club×player_id. No client hard-delete.';

COMMENT ON COLUMN public.player_identity_links.player_id IS
  'Canonical Player Management player_id (text). Never uuid-equated to auth.users.id.';

COMMENT ON COLUMN public.player_identity_links.principal_id IS
  'Authenticated principal = auth.users.id / profiles.id (uuid).';

COMMENT ON COLUMN public.player_identity_links.provenance IS
  'Explicit write provenance (admin_rpc | deterministic_backfill | manual_owner | …).';

COMMIT;
