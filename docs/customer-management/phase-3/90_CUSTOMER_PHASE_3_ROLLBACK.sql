-- =============================================================================
-- CUSTOMER-03 — Rollback / down strategy
-- Purpose: Manual rollback for authored CUSTOMER-03 objects.
-- Status: DOCUMENTATION + SCRIPT — run only under Owner authorization after
--         backup. Does NOT run automatically. Does NOT touch Production unless
--         explicitly authorized in a separate change set.
-- Order: drop RPC → drop policies/helper → drop indexes → drop tables.
-- Warning: DROP TABLE cascades child FK data. Irreversible without restore.
-- =============================================================================

SET search_path = public, pg_temp;

-- RPC
DROP FUNCTION IF EXISTS public.customer_save_aggregate(jsonb, jsonb, jsonb);

-- Policies
DROP POLICY IF EXISTS customers_select ON public.customers;
DROP POLICY IF EXISTS customer_contact_points_select ON public.customer_contact_points;
DROP POLICY IF EXISTS customer_addresses_select ON public.customer_addresses;

-- Scope helper
DROP FUNCTION IF EXISTS public.customer_phase3_scope_allows(text, text);

-- Partial unique / supporting indexes (IF EXISTS)
DROP INDEX IF EXISTS public.customer_addresses_primary_active_uq;
DROP INDEX IF EXISTS public.customer_addresses_scope_customer_idx;
DROP INDEX IF EXISTS public.customer_contact_points_primary_phone_uq;
DROP INDEX IF EXISTS public.customer_contact_points_primary_email_uq;
DROP INDEX IF EXISTS public.customer_contact_points_active_normalized_uq;
DROP INDEX IF EXISTS public.customer_contact_points_scope_type_normalized_idx;
DROP INDEX IF EXISTS public.customer_contact_points_scope_customer_idx;
DROP INDEX IF EXISTS public.customers_tenant_venue_player_id_idx;
DROP INDEX IF EXISTS public.customers_tenant_venue_account_user_id_idx;
DROP INDEX IF EXISTS public.customers_tenant_venue_customer_number_idx;
DROP INDEX IF EXISTS public.customers_tenant_venue_display_name_idx;
DROP INDEX IF EXISTS public.customers_tenant_venue_type_idx;
DROP INDEX IF EXISTS public.customers_tenant_venue_status_idx;

-- Tables (children first for safety if FK ever non-cascade)
DROP TABLE IF EXISTS public.customer_addresses;
DROP TABLE IF EXISTS public.customer_contact_points;
DROP TABLE IF EXISTS public.customers;
