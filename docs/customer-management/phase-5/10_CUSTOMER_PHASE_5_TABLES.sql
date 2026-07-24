-- =============================================================================
-- CUSTOMER-05 — Identity / Player / CRM linkage tables
-- Purpose: Durable current-state + append-only history for Customer-side
--          typed linkages (additive to CUSTOMER-03 / CUSTOMER-04).
-- Schema: public
-- Status: AUTHORED ONLY — do not apply to Staging or Production without
--         separate Owner authorization.
-- Dependency order: CUSTOMER-03 → CUSTOMER-04 → CUSTOMER-05
-- Idempotency: CREATE TABLE IF NOT EXISTS; constraints via DO blocks.
-- Destructive: none. No Production IDs. No secrets.
-- No FK to Identity/Player/CRM internal tables (logical references only).
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 1. customer_linkages (current state — typed shared table)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_linkages (
  linkage_id text PRIMARY KEY,
  customer_id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  linkage_type text NOT NULL,
  external_reference_id text NOT NULL,
  external_reference_type text NOT NULL,
  external_system text NOT NULL,
  status text NOT NULL,
  source text NOT NULL,
  evidence_reference text NULL,
  actor_reference text NULL,
  effective_at timestamptz NOT NULL,
  ended_at timestamptz NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT customer_linkages_type_chk
    CHECK (linkage_type IN ('IDENTITY_ACCOUNT', 'PLAYER', 'CRM_CONTACT')),
  CONSTRAINT customer_linkages_status_chk
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'UNLINKED')),
  CONSTRAINT customer_linkages_source_chk
    CHECK (source IN ('MANUAL', 'IMPORT', 'SYSTEM', 'MIGRATION')),
  CONSTRAINT customer_linkages_external_reference_nonblank
    CHECK (length(trim(external_reference_id)) > 0),
  CONSTRAINT customer_linkages_external_system_nonblank
    CHECK (length(trim(external_system)) > 0),
  CONSTRAINT customer_linkages_version_positive
    CHECK (version >= 1),
  CONSTRAINT customer_linkages_updated_at_gte_created_at
    CHECK (updated_at >= created_at),
  CONSTRAINT customer_linkages_ended_at_status
    CHECK (
      (status = 'ACTIVE' AND ended_at IS NULL)
      OR (status IN ('INACTIVE', 'UNLINKED') AND ended_at IS NOT NULL)
    ),
  CONSTRAINT customer_linkages_customer_fk
    FOREIGN KEY (tenant_id, venue_id, customer_id)
    REFERENCES public.customers (tenant_id, venue_id, customer_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

COMMENT ON TABLE public.customer_linkages IS
  'CUSTOMER-05 customer-side typed linkages. External IDs are logical references validated by directory ports. No auto-link by email/phone/name.';

-- -----------------------------------------------------------------------------
-- 2. customer_linkage_history (append-only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_linkage_history (
  history_id text PRIMARY KEY,
  linkage_id text NOT NULL,
  customer_id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  linkage_type text NOT NULL,
  external_reference_id text NOT NULL,
  previous_status text NULL,
  next_status text NOT NULL,
  action text NOT NULL,
  source text NULL,
  reason text NULL,
  evidence_reference text NULL,
  actor_reference text NULL,
  effective_at timestamptz NULL,
  sequence integer NOT NULL,
  customer_version integer NOT NULL,
  recorded_at timestamptz NOT NULL,
  CONSTRAINT customer_linkage_history_sequence_positive
    CHECK (sequence >= 1),
  CONSTRAINT customer_linkage_history_customer_version_positive
    CHECK (customer_version >= 1),
  CONSTRAINT customer_linkage_history_action_chk
    CHECK (action IN ('LINK', 'UNLINK', 'DEACTIVATE', 'REACTIVATE')),
  CONSTRAINT customer_linkage_history_customer_fk
    FOREIGN KEY (tenant_id, venue_id, customer_id)
    REFERENCES public.customers (tenant_id, venue_id, customer_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_linkage_history_linkage_sequence_uq'
      AND conrelid = 'public.customer_linkage_history'::regclass
  ) THEN
    ALTER TABLE public.customer_linkage_history
      ADD CONSTRAINT customer_linkage_history_linkage_sequence_uq
      UNIQUE (linkage_id, sequence);
  END IF;
END $$;

COMMENT ON TABLE public.customer_linkage_history IS
  'CUSTOMER-05 append-only linkage history. Never update/delete via client. No credentials or full external profile snapshots.';
