-- Wave 3 Phase B — RLS NOTES / draft helpers
-- DO NOT blindly replace production policies.
-- Review each policy that compares profiles.venue_id to tenant_subscriptions.tenant_id.

-- Helper: actor tenant (prefer profiles.tenant_id; fall back to venue_id during transition)
CREATE OR REPLACE FUNCTION public.user_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(p.tenant_id, ''),
    NULLIF(p.venue_id, '')
  )
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

-- Helper: actor home venue (facility) — never invent from tenant unless equal by data
CREATE OR REPLACE FUNCTION public.user_home_venue_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(p.venue_id, '')
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

COMMENT ON FUNCTION public.user_tenant_id() IS
  'Wave 3 actor tenant scope. Distinct from home venue.';
COMMENT ON FUNCTION public.user_home_venue_id() IS
  'Wave 3 actor home venue facility id.';

-- Example policy direction (DO NOT auto-apply without Owner RLS review):
-- tenant_subscriptions SELECT: tenant_id = public.user_tenant_id() OR is_super_admin()
-- venues SELECT: tenant_id = public.user_tenant_id() OR id = public.user_home_venue_id() OR is_super_admin()

-- Enable RLS on new table when Owner authorizes policy set:
-- ALTER TABLE public.platform_tenants ENABLE ROW LEVEL SECURITY;
