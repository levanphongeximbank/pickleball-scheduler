-- Wave 3 Phase B — RLS POLICIES (explicit, dual-gated)
-- DO NOT execute with 02_APPLY / 03_BACKFILL.
-- Required:
--   OWNER_SQL_GO_WAVE3_PHASE_B=YES
--   OWNER_RLS_DEPLOY_GO=YES
--   SET app.owner_rls_deploy_go = 'YES';
--
-- Design: 04_RLS_PACKAGE.md

DO $$
BEGIN
  IF current_setting('app.owner_rls_deploy_go', true) IS DISTINCT FROM 'YES' THEN
    RAISE EXCEPTION
      'OWNER_RLS_DEPLOY_GO is not YES. Refusing to deploy Wave 3 platform_tenants RLS.';
  END IF;
END $$;

BEGIN;

CREATE OR REPLACE FUNCTION public.user_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- WAVE3_USER_TENANT_ID_VENUE_FALLBACK
  -- Removal: all venue-assigned profiles have tenant_id
  -- AND OWNER_RETIRE_USER_TENANT_VENUE_FALLBACK=YES
  SELECT COALESCE(
    NULLIF(btrim(p.tenant_id), ''),
    NULLIF(btrim(p.venue_id), '')
  )
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_home_venue_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Never invent Venue identity from Tenant identity.
  SELECT NULLIF(btrim(p.venue_id), '')
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

COMMENT ON FUNCTION public.user_tenant_id() IS
  'Wave 3 actor Tenant scope. WAVE3_USER_TENANT_ID_VENUE_FALLBACK: COALESCE(tenant_id, venue_id). Distinct from home venue.';
COMMENT ON FUNCTION public.user_home_venue_id() IS
  'Wave 3 actor home Venue. profiles.venue_id only. Must not fall back to tenant_id.';

REVOKE ALL ON FUNCTION public.user_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_home_venue_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_home_venue_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_tenant_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.user_home_venue_id() TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_tenants TO authenticated;

ALTER TABLE public.platform_tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_tenants_select ON public.platform_tenants;
CREATE POLICY platform_tenants_select
  ON public.platform_tenants
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR id = public.user_tenant_id()
  );

DROP POLICY IF EXISTS platform_tenants_insert ON public.platform_tenants;
CREATE POLICY platform_tenants_insert
  ON public.platform_tenants
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS platform_tenants_update ON public.platform_tenants;
CREATE POLICY platform_tenants_update
  ON public.platform_tenants
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS platform_tenants_delete ON public.platform_tenants;
CREATE POLICY platform_tenants_delete
  ON public.platform_tenants
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

COMMIT;
