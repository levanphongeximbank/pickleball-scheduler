-- =============================================================================
-- CUSTOMER-05 — Indexes and unique active constraints
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE INDEX IF NOT EXISTS customer_linkages_scope_customer_idx
  ON public.customer_linkages (tenant_id, venue_id, customer_id);

CREATE INDEX IF NOT EXISTS customer_linkages_type_external_idx
  ON public.customer_linkages (tenant_id, venue_id, linkage_type, external_system, external_reference_id);

CREATE INDEX IF NOT EXISTS customer_linkage_history_scope_customer_idx
  ON public.customer_linkage_history (tenant_id, venue_id, customer_id);

CREATE INDEX IF NOT EXISTS customer_linkage_history_linkage_idx
  ON public.customer_linkage_history (linkage_id, sequence);

-- One active Identity account per Customer within venue scope
CREATE UNIQUE INDEX IF NOT EXISTS customer_linkages_active_identity_per_customer_uq
  ON public.customer_linkages (tenant_id, venue_id, customer_id)
  WHERE status = 'ACTIVE' AND linkage_type = 'IDENTITY_ACCOUNT';

-- One active Customer per Identity account within venue scope
CREATE UNIQUE INDEX IF NOT EXISTS customer_linkages_active_identity_external_uq
  ON public.customer_linkages (tenant_id, venue_id, external_reference_id)
  WHERE status = 'ACTIVE' AND linkage_type = 'IDENTITY_ACCOUNT';

-- One active Player per Customer within venue scope
CREATE UNIQUE INDEX IF NOT EXISTS customer_linkages_active_player_per_customer_uq
  ON public.customer_linkages (tenant_id, venue_id, customer_id)
  WHERE status = 'ACTIVE' AND linkage_type = 'PLAYER';

-- One active Customer per Player within venue scope
CREATE UNIQUE INDEX IF NOT EXISTS customer_linkages_active_player_external_uq
  ON public.customer_linkages (tenant_id, venue_id, external_reference_id)
  WHERE status = 'ACTIVE' AND linkage_type = 'PLAYER';

-- One active Customer per CRM reference within venue + external_system namespace
CREATE UNIQUE INDEX IF NOT EXISTS customer_linkages_active_crm_external_uq
  ON public.customer_linkages (tenant_id, venue_id, external_system, external_reference_id)
  WHERE status = 'ACTIVE' AND linkage_type = 'CRM_CONTACT';
