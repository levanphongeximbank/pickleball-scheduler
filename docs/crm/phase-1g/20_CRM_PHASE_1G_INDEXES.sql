-- =============================================================================
-- CRM Phase 1G — Indexes
-- Purpose: Deterministic repository query support for Phase 1G tables.
-- Status: AUTHORED ONLY — do not apply in Phase 1G.
-- Idempotency: CREATE INDEX IF NOT EXISTS.
-- =============================================================================

SET search_path = public, pg_temp;

-- crm_tags
CREATE INDEX IF NOT EXISTS crm_tags_tenant_venue_normalized_code_idx
  ON public.crm_tags (tenant_id, venue_id, normalized_code);

CREATE INDEX IF NOT EXISTS crm_tags_tenant_venue_active_idx
  ON public.crm_tags (tenant_id, venue_id, active);

CREATE INDEX IF NOT EXISTS crm_tags_tenant_venue_normalized_name_tag_id_idx
  ON public.crm_tags (tenant_id, venue_id, normalized_name, tag_id);

-- crm_tag_assignments
CREATE INDEX IF NOT EXISTS crm_tag_assignments_tenant_venue_target_idx
  ON public.crm_tag_assignments (tenant_id, venue_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS crm_tag_assignments_tenant_venue_tag_id_idx
  ON public.crm_tag_assignments (tenant_id, venue_id, tag_id);

-- Unique assignment key already covered by crm_tag_assignments_unique_target_tag_uq

-- crm_consent_records
CREATE INDEX IF NOT EXISTS crm_consent_tenant_venue_contact_channel_purpose_idx
  ON public.crm_consent_records (tenant_id, venue_id, contact_ref_id, channel, purpose);

CREATE INDEX IF NOT EXISTS crm_consent_effective_at_desc_idx
  ON public.crm_consent_records (effective_at DESC);

CREATE INDEX IF NOT EXISTS crm_consent_created_at_desc_idx
  ON public.crm_consent_records (created_at DESC);

CREATE INDEX IF NOT EXISTS crm_consent_consent_id_idx
  ON public.crm_consent_records (consent_id);

-- crm_pending_events
CREATE INDEX IF NOT EXISTS crm_pending_events_claim_queue_idx
  ON public.crm_pending_events (tenant_id, venue_id, status, available_at, created_at, pending_event_id);

CREATE INDEX IF NOT EXISTS crm_pending_events_claim_expires_at_idx
  ON public.crm_pending_events (claim_expires_at)
  WHERE claim_expires_at IS NOT NULL;

-- Unique event_id scope key covered by crm_pending_events_tenant_venue_event_id_uq
