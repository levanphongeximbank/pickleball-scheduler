-- =============================================================================
-- CUSTOMER-03 — Tables and constraints
-- Purpose: Durable persistence for Customer aggregate (profile, contacts,
--          addresses). Linkage refs stored on parent; classification /
--          preferences / consent refs as jsonb overlays (CUSTOMER-01 public).
-- Schema: public
-- Status: AUTHORED ONLY — do not apply to Staging or Production in CUSTOMER-03
--         without separate Owner authorization.
-- Idempotency: CREATE TABLE IF NOT EXISTS; constraints via DO blocks.
-- Destructive: none. No Production IDs. No secrets.
-- No legacy club-blob / booking / merge migration in this pack.
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 1. customers (aggregate root)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  customer_id text PRIMARY KEY,
  customer_number text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  customer_type text NOT NULL,
  status text NOT NULL,
  display_name text NOT NULL,
  legal_name text NULL,
  locale text NULL,
  individual_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  organization_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  account_user_id text NULL,
  player_id text NULL,
  organization_id text NULL,
  classification jsonb NOT NULL DEFAULT '[]'::jsonb,
  segment_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  communication_preferences jsonb NOT NULL DEFAULT '[]'::jsonb,
  consent_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT customers_customer_type_chk
    CHECK (customer_type IN ('INDIVIDUAL', 'ORGANIZATION')),
  CONSTRAINT customers_status_chk
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED')),
  CONSTRAINT customers_display_name_nonempty
    CHECK (length(trim(display_name)) > 0),
  CONSTRAINT customers_customer_number_nonempty
    CHECK (length(trim(customer_number)) > 0),
  CONSTRAINT customers_tenant_id_nonempty
    CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT customers_venue_id_nonempty
    CHECK (length(trim(venue_id)) > 0),
  CONSTRAINT customers_version_positive
    CHECK (version >= 1),
  CONSTRAINT customers_updated_at_gte_created_at
    CHECK (updated_at >= created_at),
  CONSTRAINT customers_individual_profile_object
    CHECK (jsonb_typeof(individual_profile) = 'object'),
  CONSTRAINT customers_organization_profile_object
    CHECK (jsonb_typeof(organization_profile) = 'object'),
  CONSTRAINT customers_classification_array
    CHECK (jsonb_typeof(classification) = 'array'),
  CONSTRAINT customers_segment_references_array
    CHECK (jsonb_typeof(segment_references) = 'array'),
  CONSTRAINT customers_tags_array
    CHECK (jsonb_typeof(tags) = 'array'),
  CONSTRAINT customers_communication_preferences_array
    CHECK (jsonb_typeof(communication_preferences) = 'array'),
  CONSTRAINT customers_consent_references_array
    CHECK (jsonb_typeof(consent_references) = 'array'),
  CONSTRAINT customers_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_tenant_venue_customer_number_uq'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_tenant_venue_customer_number_uq
      UNIQUE (tenant_id, venue_id, customer_number);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_tenant_venue_customer_id_uq'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_tenant_venue_customer_id_uq
      UNIQUE (tenant_id, venue_id, customer_id);
  END IF;
END $$;

COMMENT ON TABLE public.customers IS
  'CUSTOMER-03 customer aggregate root. Scoped by tenant_id + venue_id. Soft archive via status=ARCHIVED (no archived_at). Optimistic concurrency via version.';

COMMENT ON COLUMN public.customers.version IS
  'Aggregate optimistic concurrency token. Create starts at 1. Each logical save increments by exactly 1.';

-- -----------------------------------------------------------------------------
-- 2. customer_contact_points
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_contact_points (
  contact_point_id text PRIMARY KEY,
  customer_id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  contact_type text NOT NULL,
  normalized_value text NOT NULL,
  display_value text NOT NULL,
  purpose text NOT NULL DEFAULT 'GENERAL',
  is_primary boolean NOT NULL DEFAULT false,
  verification_state text NOT NULL DEFAULT 'UNVERIFIED',
  status text NOT NULL DEFAULT 'ACTIVE',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT customer_contact_points_type_chk
    CHECK (contact_type IN ('EMAIL', 'PHONE')),
  CONSTRAINT customer_contact_points_purpose_chk
    CHECK (purpose IN ('GENERAL', 'BILLING', 'OPERATIONS', 'OTHER')),
  CONSTRAINT customer_contact_points_verification_chk
    CHECK (verification_state IN ('UNVERIFIED', 'VERIFIED', 'FAILED', 'REJECTED')),
  CONSTRAINT customer_contact_points_status_chk
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT customer_contact_points_normalized_nonempty
    CHECK (length(trim(normalized_value)) > 0),
  CONSTRAINT customer_contact_points_display_nonempty
    CHECK (length(trim(display_value)) > 0),
  CONSTRAINT customer_contact_points_version_positive
    CHECK (version >= 1),
  CONSTRAINT customer_contact_points_updated_at_gte_created_at
    CHECK (updated_at >= created_at),
  CONSTRAINT customer_contact_points_customer_fk
    FOREIGN KEY (tenant_id, venue_id, customer_id)
    REFERENCES public.customers (tenant_id, venue_id, customer_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT customer_contact_points_primary_requires_active
    CHECK (is_primary = false OR status = 'ACTIVE')
);

COMMENT ON TABLE public.customer_contact_points IS
  'CUSTOMER-03 normalized contact points. Uniqueness of active normalized values and primary-per-type enforced by partial unique indexes.';

-- -----------------------------------------------------------------------------
-- 3. customer_addresses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  address_id text PRIMARY KEY,
  customer_id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  address_type text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text NULL,
  locality text NULL,
  admin_area text NULL,
  postal_code text NULL,
  country_code text NOT NULL DEFAULT 'VN',
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ACTIVE',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT customer_addresses_type_chk
    CHECK (address_type IN ('POSTAL', 'BUSINESS', 'BILLING', 'OTHER')),
  CONSTRAINT customer_addresses_status_chk
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT customer_addresses_line1_nonempty
    CHECK (length(trim(address_line1)) > 0),
  CONSTRAINT customer_addresses_country_code_chk
    CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT customer_addresses_version_positive
    CHECK (version >= 1),
  CONSTRAINT customer_addresses_updated_at_gte_created_at
    CHECK (updated_at >= created_at),
  CONSTRAINT customer_addresses_customer_fk
    FOREIGN KEY (tenant_id, venue_id, customer_id)
    REFERENCES public.customers (tenant_id, venue_id, customer_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT customer_addresses_primary_requires_active
    CHECK (is_primary = false OR status = 'ACTIVE')
);

COMMENT ON TABLE public.customer_addresses IS
  'CUSTOMER-03 normalized addresses. At most one primary ACTIVE address per customer (partial unique index).';
