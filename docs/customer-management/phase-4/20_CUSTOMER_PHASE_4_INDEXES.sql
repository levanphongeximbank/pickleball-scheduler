-- =============================================================================
-- CUSTOMER-04 — Indexes
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE INDEX IF NOT EXISTS customer_consents_customer_idx
  ON public.customer_consents (tenant_id, venue_id, customer_id);

CREATE INDEX IF NOT EXISTS customer_consents_purpose_status_idx
  ON public.customer_consents (tenant_id, venue_id, purpose, status);

CREATE INDEX IF NOT EXISTS customer_consent_history_consent_idx
  ON public.customer_consent_history (consent_id, sequence);

CREATE INDEX IF NOT EXISTS customer_consent_history_customer_idx
  ON public.customer_consent_history (tenant_id, venue_id, customer_id);

CREATE INDEX IF NOT EXISTS customer_prefs_customer_idx
  ON public.customer_communication_preferences (tenant_id, venue_id, customer_id);

CREATE INDEX IF NOT EXISTS customer_prefs_purpose_channel_idx
  ON public.customer_communication_preferences (tenant_id, venue_id, purpose, channel);

CREATE INDEX IF NOT EXISTS customer_preference_history_pref_idx
  ON public.customer_preference_history (preference_id, sequence);

CREATE INDEX IF NOT EXISTS customer_preference_history_customer_idx
  ON public.customer_preference_history (tenant_id, venue_id, customer_id);
