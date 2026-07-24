-- =============================================================================
-- CUSTOMER-03 — Indexes and partial uniqueness
-- Purpose: Query support + uniqueness invariants for Customer aggregate.
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- Idempotency: CREATE INDEX IF NOT EXISTS.
-- Global email/phone uniqueness across customers is intentionally NOT imposed.
-- =============================================================================

SET search_path = public, pg_temp;

-- customers
CREATE INDEX IF NOT EXISTS customers_tenant_venue_status_idx
  ON public.customers (tenant_id, venue_id, status);

CREATE INDEX IF NOT EXISTS customers_tenant_venue_type_idx
  ON public.customers (tenant_id, venue_id, customer_type);

CREATE INDEX IF NOT EXISTS customers_tenant_venue_display_name_idx
  ON public.customers (tenant_id, venue_id, display_name);

CREATE INDEX IF NOT EXISTS customers_tenant_venue_customer_number_idx
  ON public.customers (tenant_id, venue_id, customer_number);

CREATE INDEX IF NOT EXISTS customers_tenant_venue_account_user_id_idx
  ON public.customers (tenant_id, venue_id, account_user_id)
  WHERE account_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS customers_tenant_venue_player_id_idx
  ON public.customers (tenant_id, venue_id, player_id)
  WHERE player_id IS NOT NULL;

-- customer_contact_points
CREATE INDEX IF NOT EXISTS customer_contact_points_scope_customer_idx
  ON public.customer_contact_points (tenant_id, venue_id, customer_id);

CREATE INDEX IF NOT EXISTS customer_contact_points_scope_type_normalized_idx
  ON public.customer_contact_points (tenant_id, venue_id, contact_type, normalized_value);

-- Unique active normalized value within a single customer (not cross-customer)
CREATE UNIQUE INDEX IF NOT EXISTS customer_contact_points_active_normalized_uq
  ON public.customer_contact_points (customer_id, contact_type, normalized_value)
  WHERE status = 'ACTIVE';

-- At most one primary ACTIVE email per customer
CREATE UNIQUE INDEX IF NOT EXISTS customer_contact_points_primary_email_uq
  ON public.customer_contact_points (customer_id)
  WHERE is_primary = true
    AND status = 'ACTIVE'
    AND contact_type = 'EMAIL';

-- At most one primary ACTIVE phone per customer
CREATE UNIQUE INDEX IF NOT EXISTS customer_contact_points_primary_phone_uq
  ON public.customer_contact_points (customer_id)
  WHERE is_primary = true
    AND status = 'ACTIVE'
    AND contact_type = 'PHONE';

-- customer_addresses
CREATE INDEX IF NOT EXISTS customer_addresses_scope_customer_idx
  ON public.customer_addresses (tenant_id, venue_id, customer_id);

-- At most one primary ACTIVE address per customer
CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_primary_active_uq
  ON public.customer_addresses (customer_id)
  WHERE is_primary = true
    AND status = 'ACTIVE';
