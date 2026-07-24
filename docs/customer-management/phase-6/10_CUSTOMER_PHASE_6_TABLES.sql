-- =============================================================================
-- CUSTOMER-06 — Search / dedup / merge tables + customers ALTER
-- Status: AUTHORED ONLY — do not apply to Staging or Production without
--         separate Owner authorization.
-- Dependency order: CUSTOMER-03 → CUSTOMER-04 → CUSTOMER-05 → CUSTOMER-06
-- Destructive: none. No Production IDs. No secrets.
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 1. Extend customers status + merge redirect columns
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_status_chk'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers DROP CONSTRAINT customers_status_chk;
  END IF;
END $$;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_status_chk
  CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED', 'MERGED'));

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS merged_into_customer_id text NULL;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS merged_at timestamptz NULL;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS merge_history_id text NULL;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS merge_proposal_id text NULL;

COMMENT ON COLUMN public.customers.merged_into_customer_id IS
  'CUSTOMER-06 survivor customer id when status=MERGED. getById still returns this row.';

-- -----------------------------------------------------------------------------
-- 2. customer_duplicate_candidates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_duplicate_candidates (
  candidate_id text PRIMARY KEY,
  customer_id_a text NOT NULL,
  customer_id_b text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  classification text NOT NULL,
  score integer NULL,
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL,
  detected_at timestamptz NOT NULL,
  evaluated_at timestamptz NOT NULL,
  evaluated_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'SYSTEM',
  reviewed_at timestamptz NULL,
  review_reference text NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT customer_duplicate_candidates_pair_ordered
    CHECK (customer_id_a < customer_id_b),
  CONSTRAINT customer_duplicate_candidates_status_chk
    CHECK (status IN ('OPEN', 'REVIEW_REQUIRED', 'APPROVED_FOR_MERGE', 'REJECTED', 'RESOLVED')),
  CONSTRAINT customer_duplicate_candidates_version_positive
    CHECK (version >= 1),
  CONSTRAINT customer_duplicate_candidates_signals_array
    CHECK (jsonb_typeof(signals) = 'array'),
  CONSTRAINT customer_duplicate_candidates_conflicts_array
    CHECK (jsonb_typeof(conflicts) = 'array'),
  CONSTRAINT customer_duplicate_candidates_customer_a_fk
    FOREIGN KEY (tenant_id, venue_id, customer_id_a)
    REFERENCES public.customers (tenant_id, venue_id, customer_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT customer_duplicate_candidates_customer_b_fk
    FOREIGN KEY (tenant_id, venue_id, customer_id_b)
    REFERENCES public.customers (tenant_id, venue_id, customer_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_duplicate_candidates_pair_uq'
      AND conrelid = 'public.customer_duplicate_candidates'::regclass
  ) THEN
    ALTER TABLE public.customer_duplicate_candidates
      ADD CONSTRAINT customer_duplicate_candidates_pair_uq
      UNIQUE (tenant_id, venue_id, customer_id_a, customer_id_b);
  END IF;
END $$;

COMMENT ON TABLE public.customer_duplicate_candidates IS
  'CUSTOMER-06 duplicate candidates. Matching email/phone/name is evidence only — never auto-merge.';

-- -----------------------------------------------------------------------------
-- 3. customer_merge_proposals
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_merge_proposals (
  merge_proposal_id text PRIMARY KEY,
  candidate_id text NULL,
  survivor_customer_id text NOT NULL,
  absorbed_customer_id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  expected_survivor_version integer NULL,
  expected_absorbed_version integer NULL,
  profile_resolution jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_resolution jsonb NOT NULL DEFAULT '{}'::jsonb,
  address_resolution jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_resolution jsonb NOT NULL DEFAULT '{}'::jsonb,
  preference_resolution jsonb NOT NULL DEFAULT '{}'::jsonb,
  linkage_resolution jsonb NOT NULL DEFAULT '{}'::jsonb,
  conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
  match_kinds jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_status text NOT NULL,
  approval_reference text NULL,
  approved_by text NULL,
  approved_at timestamptz NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT customer_merge_proposals_distinct
    CHECK (survivor_customer_id <> absorbed_customer_id),
  CONSTRAINT customer_merge_proposals_status_chk
    CHECK (status IN ('CANDIDATE', 'DRAFT', 'APPROVED', 'REJECTED', 'COMPLETED')),
  CONSTRAINT customer_merge_proposals_approval_status_chk
    CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT customer_merge_proposals_version_positive
    CHECK (version >= 1),
  CONSTRAINT customer_merge_proposals_survivor_fk
    FOREIGN KEY (tenant_id, venue_id, survivor_customer_id)
    REFERENCES public.customers (tenant_id, venue_id, customer_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT customer_merge_proposals_absorbed_fk
    FOREIGN KEY (tenant_id, venue_id, absorbed_customer_id)
    REFERENCES public.customers (tenant_id, venue_id, customer_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

COMMENT ON TABLE public.customer_merge_proposals IS
  'CUSTOMER-06 merge proposals. Execution requires APPROVED + approval_reference.';

-- -----------------------------------------------------------------------------
-- 4. customer_merge_history (append-only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_merge_history (
  merge_history_id text PRIMARY KEY,
  merge_proposal_id text NULL,
  candidate_id text NULL,
  survivor_customer_id text NOT NULL,
  absorbed_customer_id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  approval_reference text NULL,
  actor_reference text NULL,
  survivor_version_after integer NULL,
  absorbed_version_at_merge integer NULL,
  resolution_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  recorded_at timestamptz NOT NULL,
  CONSTRAINT customer_merge_history_survivor_fk
    FOREIGN KEY (tenant_id, venue_id, survivor_customer_id)
    REFERENCES public.customers (tenant_id, venue_id, customer_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT customer_merge_history_absorbed_fk
    FOREIGN KEY (tenant_id, venue_id, absorbed_customer_id)
    REFERENCES public.customers (tenant_id, venue_id, customer_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

COMMENT ON TABLE public.customer_merge_history IS
  'CUSTOMER-06 immutable merge history. Append-only.';
