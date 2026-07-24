-- =============================================================================
-- CUSTOMER-04 — Consent & Communication Preference tables
-- Purpose: Durable current-state + append-only history for Customer consent
--          and communication preferences (additive to CUSTOMER-03).
-- Schema: public
-- Status: AUTHORED ONLY — do not apply to Staging or Production without
--         separate Owner authorization. Depends on CUSTOMER-03 customers table.
-- Idempotency: CREATE TABLE IF NOT EXISTS; constraints via DO blocks.
-- Destructive: none. No Production IDs. No secrets.
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 1. customer_consents (current state)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_consents (
  consent_id text PRIMARY KEY,
  customer_id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  purpose text NOT NULL,
  channel text NULL,
  status text NOT NULL,
  effective_at timestamptz NOT NULL,
  expires_at timestamptz NULL,
  revoked_at timestamptz NULL,
  source text NOT NULL,
  evidence_reference text NULL,
  actor_reference text NULL,
  captured_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT customer_consents_purpose_chk
    CHECK (purpose IN (
      'MARKETING',
      'SERVICE',
      'EVENT_UPDATE',
      'BOOKING_UPDATE',
      'COMPETITION_UPDATE',
      'MEMBERSHIP_UPDATE'
    )),
  CONSTRAINT customer_consents_channel_chk
    CHECK (channel IS NULL OR channel IN ('EMAIL', 'SMS', 'PHONE', 'PUSH')),
  CONSTRAINT customer_consents_status_chk
    CHECK (status IN ('GRANTED', 'DENIED', 'REVOKED', 'EXPIRED')),
  CONSTRAINT customer_consents_source_chk
    CHECK (source IN ('CUSTOMER', 'CRM', 'IMPORT', 'SYSTEM', 'STAFF', 'SELF_SERVICE')),
  CONSTRAINT customer_consents_version_positive
    CHECK (version >= 1),
  CONSTRAINT customer_consents_updated_at_gte_created_at
    CHECK (updated_at >= created_at),
  CONSTRAINT customer_consents_expires_after_effective
    CHECK (expires_at IS NULL OR expires_at > effective_at),
  CONSTRAINT customer_consents_revoked_at_requires_revoked
    CHECK (
      (status = 'REVOKED' AND revoked_at IS NOT NULL)
      OR (status <> 'REVOKED' AND revoked_at IS NULL)
    ),
  CONSTRAINT customer_consents_granted_requires_evidence
    CHECK (status <> 'GRANTED' OR evidence_reference IS NOT NULL),
  CONSTRAINT customer_consents_customer_fk
    FOREIGN KEY (tenant_id, venue_id, customer_id)
    REFERENCES public.customers (tenant_id, venue_id, customer_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_consents_scope_purpose_channel_uq'
      AND conrelid = 'public.customer_consents'::regclass
  ) THEN
    ALTER TABLE public.customer_consents
      ADD CONSTRAINT customer_consents_scope_purpose_channel_uq
      UNIQUE NULLS NOT DISTINCT (tenant_id, venue_id, customer_id, purpose, channel);
  END IF;
END $$;

COMMENT ON TABLE public.customer_consents IS
  'CUSTOMER-04 current consent business state. Not a legal-policy engine. Evidence stored as opaque reference only.';

-- -----------------------------------------------------------------------------
-- 2. customer_consent_history (append-only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_consent_history (
  history_id text PRIMARY KEY,
  consent_id text NOT NULL,
  customer_id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  sequence integer NOT NULL,
  previous_status text NOT NULL,
  next_status text NOT NULL,
  purpose text NOT NULL,
  channel text NULL,
  effective_at timestamptz NULL,
  source text NULL,
  evidence_reference text NULL,
  actor_reference text NULL,
  reason text NULL,
  aggregate_version integer NOT NULL,
  recorded_at timestamptz NOT NULL,
  CONSTRAINT customer_consent_history_sequence_positive
    CHECK (sequence >= 1),
  CONSTRAINT customer_consent_history_aggregate_version_positive
    CHECK (aggregate_version >= 1),
  CONSTRAINT customer_consent_history_customer_fk
    FOREIGN KEY (tenant_id, venue_id, customer_id)
    REFERENCES public.customers (tenant_id, venue_id, customer_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_consent_history_consent_sequence_uq'
      AND conrelid = 'public.customer_consent_history'::regclass
  ) THEN
    ALTER TABLE public.customer_consent_history
      ADD CONSTRAINT customer_consent_history_consent_sequence_uq
      UNIQUE (consent_id, sequence);
  END IF;
END $$;

COMMENT ON TABLE public.customer_consent_history IS
  'CUSTOMER-04 append-only consent change history. Never update/delete via client.';

-- -----------------------------------------------------------------------------
-- 3. customer_communication_preferences (current state)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_communication_preferences (
  preference_id text PRIMARY KEY,
  customer_id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  purpose text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL,
  effective_at timestamptz NOT NULL,
  source text NOT NULL,
  actor_reference text NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT customer_prefs_purpose_chk
    CHECK (purpose IN (
      'MARKETING',
      'SERVICE',
      'EVENT_UPDATE',
      'BOOKING_UPDATE',
      'COMPETITION_UPDATE',
      'MEMBERSHIP_UPDATE'
    )),
  CONSTRAINT customer_prefs_channel_chk
    CHECK (channel IN ('EMAIL', 'SMS', 'PHONE', 'PUSH')),
  CONSTRAINT customer_prefs_status_chk
    CHECK (status IN ('OPTED_IN', 'OPTED_OUT', 'UNSPECIFIED')),
  CONSTRAINT customer_prefs_source_chk
    CHECK (source IN ('CUSTOMER', 'CRM', 'IMPORT', 'SYSTEM', 'STAFF', 'SELF_SERVICE')),
  CONSTRAINT customer_prefs_version_positive
    CHECK (version >= 1),
  CONSTRAINT customer_prefs_updated_at_gte_created_at
    CHECK (updated_at >= created_at),
  CONSTRAINT customer_prefs_customer_fk
    FOREIGN KEY (tenant_id, venue_id, customer_id)
    REFERENCES public.customers (tenant_id, venue_id, customer_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_prefs_scope_purpose_channel_uq'
      AND conrelid = 'public.customer_communication_preferences'::regclass
  ) THEN
    ALTER TABLE public.customer_communication_preferences
      ADD CONSTRAINT customer_prefs_scope_purpose_channel_uq
      UNIQUE (tenant_id, venue_id, customer_id, purpose, channel);
  END IF;
END $$;

COMMENT ON TABLE public.customer_communication_preferences IS
  'CUSTOMER-04 current communication preference by purpose×channel. Preference is not consent.';

-- -----------------------------------------------------------------------------
-- 4. customer_preference_history (append-only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_preference_history (
  history_id text PRIMARY KEY,
  preference_id text NOT NULL,
  customer_id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  sequence integer NOT NULL,
  previous_status text NOT NULL,
  next_status text NOT NULL,
  purpose text NOT NULL,
  channel text NOT NULL,
  effective_at timestamptz NULL,
  source text NULL,
  actor_reference text NULL,
  reason text NULL,
  aggregate_version integer NOT NULL,
  recorded_at timestamptz NOT NULL,
  CONSTRAINT customer_preference_history_sequence_positive
    CHECK (sequence >= 1),
  CONSTRAINT customer_preference_history_aggregate_version_positive
    CHECK (aggregate_version >= 1),
  CONSTRAINT customer_preference_history_customer_fk
    FOREIGN KEY (tenant_id, venue_id, customer_id)
    REFERENCES public.customers (tenant_id, venue_id, customer_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_preference_history_pref_sequence_uq'
      AND conrelid = 'public.customer_preference_history'::regclass
  ) THEN
    ALTER TABLE public.customer_preference_history
      ADD CONSTRAINT customer_preference_history_pref_sequence_uq
      UNIQUE (preference_id, sequence);
  END IF;
END $$;

COMMENT ON TABLE public.customer_preference_history IS
  'CUSTOMER-04 append-only preference change history. Never update/delete via client.';
