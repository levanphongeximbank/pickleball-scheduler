-- =============================================================================
-- CUSTOMER-03 — RLS enablement and fail-closed policies
-- Purpose: Tenant/venue-scoped RLS for Customer tables using ONLY verified
--          PICK_VN helpers: auth.uid(), public.user_venue_id(),
--          public.user_has_permission(text), public.is_super_admin().
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
--
-- Architecture note (Sprint-2 identity — same as CRM Phase 1G):
--   Verified JWT binding is profiles.venue_id via user_venue_id().
--   No verified dual-scope user_tenant_id() distinct from venue exists.
--   Therefore policies require BOTH:
--     venue_id = user_venue_id()
--     tenant_id = user_venue_id()
--   Rows where tenant_id <> venue_id cannot be accessed via JWT until Identity
--   publishes a verified tenant helper. This is fail-closed, not permissive.
--
-- Write boundary (CUSTOMER-03):
--   Authenticated JWT clients may SELECT when permission/super_admin allows.
--   Authenticated INSERT/UPDATE/DELETE policies are intentionally ABSENT.
--   Aggregate writes go through trusted service-role / server path only
--   (service_role bypasses RLS in Supabase). Client writes remain blocked until
--   Owner authorizes permission seed + write policies (Production blocker).
--
-- No anonymous policies. No USING-true open policies. No invented tenant resolver.
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- Scope helper — uses only verified helpers; no invented tenant resolver.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_phase3_scope_allows(
  p_tenant_id text,
  p_venue_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND public.user_venue_id() IS NOT NULL
    AND length(trim(coalesce(p_tenant_id, ''))) > 0
    AND length(trim(coalesce(p_venue_id, ''))) > 0
    AND p_venue_id = public.user_venue_id()
    AND p_tenant_id = public.user_venue_id();
$$;

COMMENT ON FUNCTION public.customer_phase3_scope_allows(text, text) IS
  'CUSTOMER-03 fail-closed scope gate. Requires authenticated caller with non-null user_venue_id matching both tenant_id and venue_id (Sprint-2 venue-bound identity).';

REVOKE ALL ON FUNCTION public.customer_phase3_scope_allows(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_phase3_scope_allows(text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Enable + FORCE RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contact_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contact_points FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Drop prior CUSTOMER-03 policies if re-authored (idempotent re-apply safe)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS customers_select ON public.customers;
DROP POLICY IF EXISTS customers_insert ON public.customers;
DROP POLICY IF EXISTS customers_update ON public.customers;
DROP POLICY IF EXISTS customers_delete ON public.customers;
DROP POLICY IF EXISTS customer_contact_points_select ON public.customer_contact_points;
DROP POLICY IF EXISTS customer_contact_points_insert ON public.customer_contact_points;
DROP POLICY IF EXISTS customer_contact_points_update ON public.customer_contact_points;
DROP POLICY IF EXISTS customer_contact_points_delete ON public.customer_contact_points;
DROP POLICY IF EXISTS customer_addresses_select ON public.customer_addresses;
DROP POLICY IF EXISTS customer_addresses_insert ON public.customer_addresses;
DROP POLICY IF EXISTS customer_addresses_update ON public.customer_addresses;
DROP POLICY IF EXISTS customer_addresses_delete ON public.customer_addresses;

-- No anonymous policies. No role-name-only policies. No first-venue fallback.
-- No authenticated write policies in CUSTOMER-03 (fail-closed writes).

-- -----------------------------------------------------------------------------
-- customers — SELECT only for authenticated
-- -----------------------------------------------------------------------------
CREATE POLICY customers_select ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    public.customer_phase3_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('customer.view')
      OR public.user_has_permission('customer.edit')
    )
  );

-- -----------------------------------------------------------------------------
-- customer_contact_points — SELECT only; child cannot bypass parent scope
-- -----------------------------------------------------------------------------
CREATE POLICY customer_contact_points_select ON public.customer_contact_points
  FOR SELECT
  TO authenticated
  USING (
    public.customer_phase3_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('customer.view')
      OR public.user_has_permission('customer.edit')
    )
    AND EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.tenant_id = customer_contact_points.tenant_id
        AND c.venue_id = customer_contact_points.venue_id
        AND c.customer_id = customer_contact_points.customer_id
    )
  );

-- -----------------------------------------------------------------------------
-- customer_addresses — SELECT only; child cannot bypass parent scope
-- -----------------------------------------------------------------------------
CREATE POLICY customer_addresses_select ON public.customer_addresses
  FOR SELECT
  TO authenticated
  USING (
    public.customer_phase3_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('customer.view')
      OR public.user_has_permission('customer.edit')
    )
    AND EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.tenant_id = customer_addresses.tenant_id
        AND c.venue_id = customer_addresses.venue_id
        AND c.customer_id = customer_addresses.customer_id
    )
  );
