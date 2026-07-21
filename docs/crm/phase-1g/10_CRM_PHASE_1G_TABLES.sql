-- =============================================================================
-- CRM Phase 1G — Tables and constraints
-- Purpose: Durable persistence foundation for Tags, Tag Assignments,
--          Consent Records, and Pending Events.
-- Schema: public
-- Status: AUTHORED ONLY — do not apply to Staging or Production in Phase 1G.
-- Idempotency: CREATE TABLE IF NOT EXISTS; constraints via DO blocks.
-- Destructive: none. No Production IDs. No secrets.
-- Dependencies: none (CRM Phase 1G tables are independent of other CRM tables).
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 1. crm_tags
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_tags (
  tag_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  code text NOT NULL,
  normalized_code text NOT NULL,
  description text NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  created_by_actor_id text NULL,
  updated_by_actor_id text NULL,
  CONSTRAINT crm_tags_normalized_name_nonempty
    CHECK (length(trim(normalized_name)) > 0),
  CONSTRAINT crm_tags_normalized_code_nonempty
    CHECK (length(trim(normalized_code)) > 0),
  CONSTRAINT crm_tags_updated_at_gte_created_at
    CHECK (updated_at >= created_at)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'crm_tags_tenant_venue_normalized_code_uq'
      AND conrelid = 'public.crm_tags'::regclass
  ) THEN
    ALTER TABLE public.crm_tags
      ADD CONSTRAINT crm_tags_tenant_venue_normalized_code_uq
      UNIQUE (tenant_id, venue_id, normalized_code);
  END IF;
END $$;

COMMENT ON TABLE public.crm_tags IS
  'CRM Phase 1G tag definitions. Scoped by tenant_id + venue_id. Deleting tag definitions is not supported in Phase 1G.';

-- -----------------------------------------------------------------------------
-- 2. crm_tag_assignments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_tag_assignments (
  assignment_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  tag_id text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  assigned_by_actor_id text NOT NULL,
  assigned_at timestamptz NOT NULL,
  CONSTRAINT crm_tag_assignments_target_type_chk
    CHECK (target_type IN ('CONTACT_REFERENCE', 'LEAD', 'OPPORTUNITY')),
  CONSTRAINT crm_tag_assignments_tag_fk
    FOREIGN KEY (tag_id) REFERENCES public.crm_tags (tag_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'crm_tag_assignments_unique_target_tag_uq'
      AND conrelid = 'public.crm_tag_assignments'::regclass
  ) THEN
    ALTER TABLE public.crm_tag_assignments
      ADD CONSTRAINT crm_tag_assignments_unique_target_tag_uq
      UNIQUE (tenant_id, venue_id, tag_id, target_type, target_id);
  END IF;
END $$;

COMMENT ON TABLE public.crm_tag_assignments IS
  'CRM Phase 1G tag assignments. Removing an assignment deletes only this row. No cascade to ContactReference/Lead/Opportunity. Tag definition delete unsupported.';

-- -----------------------------------------------------------------------------
-- 3. crm_consent_records (append-only business semantics)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_consent_records (
  consent_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  contact_ref_id text NOT NULL,
  channel text NOT NULL,
  purpose text NOT NULL,
  status text NOT NULL,
  source text NOT NULL DEFAULT 'CRM',
  policy_version text NOT NULL,
  effective_at timestamptz NOT NULL,
  expires_at timestamptz NULL,
  revoked_at timestamptz NULL,
  reason text NULL,
  recorded_by_actor_id text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT crm_consent_channel_chk
    CHECK (channel IN ('EMAIL', 'SMS', 'PHONE', 'PUSH')),
  CONSTRAINT crm_consent_purpose_chk
    CHECK (purpose IN ('MARKETING', 'TRANSACTIONAL', 'SERVICE', 'RESEARCH')),
  CONSTRAINT crm_consent_status_chk
    CHECK (status IN ('GRANTED', 'REVOKED')),
  CONSTRAINT crm_consent_policy_version_nonempty
    CHECK (length(trim(policy_version)) > 0),
  CONSTRAINT crm_consent_expires_after_effective
    CHECK (expires_at IS NULL OR expires_at > effective_at),
  CONSTRAINT crm_consent_revoked_at_status
    CHECK (
      (status = 'REVOKED' AND revoked_at IS NOT NULL)
      OR (status = 'GRANTED' AND revoked_at IS NULL)
    ),
  CONSTRAINT crm_consent_updated_at_gte_created_at
    CHECK (updated_at >= created_at)
);

COMMENT ON TABLE public.crm_consent_records IS
  'CRM Phase 1G consent history. Append-only: grant/revoke create new rows. Do not overwrite prior consent history.';

-- -----------------------------------------------------------------------------
-- 4. crm_pending_events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_pending_events (
  pending_event_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING',
  available_at timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  claimed_by text NULL,
  claimed_at timestamptz NULL,
  acknowledged_at timestamptz NULL,
  failed_at timestamptz NULL,
  failure_reason text NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  claim_expires_at timestamptz NULL,
  CONSTRAINT crm_pending_events_status_chk
    CHECK (status IN ('PENDING', 'CLAIMED', 'ACKNOWLEDGED', 'FAILED')),
  CONSTRAINT crm_pending_events_attempt_count_nonneg
    CHECK (attempt_count >= 0),
  CONSTRAINT crm_pending_events_payload_is_object
    CHECK (jsonb_typeof(payload_json) = 'object'),
  CONSTRAINT crm_pending_events_claimed_fields_chk
    CHECK (
      (status = 'CLAIMED'
        AND claimed_by IS NOT NULL
        AND claimed_at IS NOT NULL
        AND claim_expires_at IS NOT NULL)
      OR (status <> 'CLAIMED'
        AND (
          (status = 'PENDING' AND claimed_by IS NULL AND claimed_at IS NULL AND claim_expires_at IS NULL)
          OR (status IN ('ACKNOWLEDGED', 'FAILED'))
        ))
    ),
  CONSTRAINT crm_pending_events_acknowledged_fields_chk
    CHECK (
      (status = 'ACKNOWLEDGED' AND acknowledged_at IS NOT NULL)
      OR (status <> 'ACKNOWLEDGED' AND acknowledged_at IS NULL)
    ),
  CONSTRAINT crm_pending_events_failed_fields_chk
    CHECK (
      (status = 'FAILED'
        AND failed_at IS NOT NULL
        AND failure_reason IS NOT NULL
        AND length(trim(failure_reason)) > 0)
      OR (status <> 'FAILED' AND failed_at IS NULL AND failure_reason IS NULL)
    ),
  CONSTRAINT crm_pending_events_updated_at_gte_created_at
    CHECK (updated_at >= created_at)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'crm_pending_events_tenant_venue_event_id_uq'
      AND conrelid = 'public.crm_pending_events'::regclass
  ) THEN
    ALTER TABLE public.crm_pending_events
      ADD CONSTRAINT crm_pending_events_tenant_venue_event_id_uq
      UNIQUE (tenant_id, venue_id, event_id);
  END IF;
END $$;

COMMENT ON TABLE public.crm_pending_events IS
  'CRM Phase 1G pending-event dispatch queue. Claim via RPC only. Terminal ACKNOWLEDGED/FAILED cannot be claimed again.';
