-- =============================================================================
-- CRM Phase 1G — RLS enablement and fail-closed policies
-- Purpose: Tenant/venue-scoped RLS for CRM Phase 1G tables using ONLY verified
--          PICK_VN helpers: auth.uid(), public.user_venue_id(),
--          public.user_has_permission(text), public.is_super_admin().
-- Status: AUTHORED ONLY — do not apply in Phase 1G.
--
-- Architecture note (Sprint-2 identity):
--   Verified JWT binding is profiles.venue_id via user_venue_id().
--   No verified dual-scope user_tenant_id() exists that is distinct from venue.
--   Therefore policies require BOTH:
--     venue_id = user_venue_id()
--     tenant_id = user_venue_id()
--   Rows where tenant_id <> venue_id cannot be accessed via JWT until Identity
--   publishes a verified tenant helper. This is fail-closed, not permissive.
--   CRM application TenantVenueScope still allows distinct ids in memory/tests.
--
-- CRM permission keys must exist in role_permissions before JWT users gain
-- access (except is_super_admin). Seeding CRM permissions is out of Phase 1G.
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- Scope helper — uses only verified helpers; no invented tenant resolver.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_phase1g_scope_allows(
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

COMMENT ON FUNCTION public.crm_phase1g_scope_allows(text, text) IS
  'CRM Phase 1G fail-closed scope gate. Requires authenticated caller with non-null user_venue_id matching both tenant_id and venue_id (Sprint-2 venue-bound identity).';

REVOKE ALL ON FUNCTION public.crm_phase1g_scope_allows(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_phase1g_scope_allows(text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Enable RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pending_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tag_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crm_consent_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pending_events FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Drop prior Phase 1G policies if re-authored (idempotent re-apply safe)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_tags_select ON public.crm_tags;
DROP POLICY IF EXISTS crm_tags_insert ON public.crm_tags;
DROP POLICY IF EXISTS crm_tags_update ON public.crm_tags;
DROP POLICY IF EXISTS crm_tag_assignments_select ON public.crm_tag_assignments;
DROP POLICY IF EXISTS crm_tag_assignments_insert ON public.crm_tag_assignments;
DROP POLICY IF EXISTS crm_tag_assignments_delete ON public.crm_tag_assignments;
DROP POLICY IF EXISTS crm_consent_records_select ON public.crm_consent_records;
DROP POLICY IF EXISTS crm_consent_records_insert ON public.crm_consent_records;
DROP POLICY IF EXISTS crm_pending_events_select ON public.crm_pending_events;
DROP POLICY IF EXISTS crm_pending_events_insert ON public.crm_pending_events;
DROP POLICY IF EXISTS crm_pending_events_update ON public.crm_pending_events;

-- No anonymous policies. No role-name-only policies. No first-venue fallback.

-- -----------------------------------------------------------------------------
-- crm_tags
-- -----------------------------------------------------------------------------
CREATE POLICY crm_tags_select ON public.crm_tags
  FOR SELECT
  TO authenticated
  USING (
    public.crm_phase1g_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('crm.tag.view')
      OR public.user_has_permission('crm.tag.create')
      OR public.user_has_permission('crm.tag.update')
      OR public.user_has_permission('crm.tag.assign')
    )
  );

CREATE POLICY crm_tags_insert ON public.crm_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.crm_phase1g_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('crm.tag.create')
    )
  );

CREATE POLICY crm_tags_update ON public.crm_tags
  FOR UPDATE
  TO authenticated
  USING (
    public.crm_phase1g_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('crm.tag.update')
    )
  )
  WITH CHECK (
    public.crm_phase1g_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('crm.tag.update')
    )
  );

-- No DELETE policy on crm_tags — tag definition delete unsupported in Phase 1G.

-- -----------------------------------------------------------------------------
-- crm_tag_assignments
-- -----------------------------------------------------------------------------
CREATE POLICY crm_tag_assignments_select ON public.crm_tag_assignments
  FOR SELECT
  TO authenticated
  USING (
    public.crm_phase1g_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('crm.tag.view')
      OR public.user_has_permission('crm.tag.assign')
    )
  );

CREATE POLICY crm_tag_assignments_insert ON public.crm_tag_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.crm_phase1g_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('crm.tag.assign')
    )
  );

CREATE POLICY crm_tag_assignments_delete ON public.crm_tag_assignments
  FOR DELETE
  TO authenticated
  USING (
    public.crm_phase1g_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('crm.tag.assign')
    )
  );

-- -----------------------------------------------------------------------------
-- crm_consent_records (append-only: SELECT + INSERT only)
-- -----------------------------------------------------------------------------
CREATE POLICY crm_consent_records_select ON public.crm_consent_records
  FOR SELECT
  TO authenticated
  USING (
    public.crm_phase1g_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('crm.consent.view')
      OR public.user_has_permission('crm.consent.create')
      OR public.user_has_permission('crm.consent.revoke')
    )
  );

CREATE POLICY crm_consent_records_insert ON public.crm_consent_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.crm_phase1g_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('crm.consent.create')
      OR public.user_has_permission('crm.consent.revoke')
    )
  );

-- No UPDATE / DELETE policies — append-only consent history.

-- -----------------------------------------------------------------------------
-- crm_pending_events — audit / internal dispatch permission only
-- -----------------------------------------------------------------------------
CREATE POLICY crm_pending_events_select ON public.crm_pending_events
  FOR SELECT
  TO authenticated
  USING (
    public.crm_phase1g_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('crm.audit.view')
    )
  );

CREATE POLICY crm_pending_events_insert ON public.crm_pending_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.crm_phase1g_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('crm.audit.view')
    )
  );

CREATE POLICY crm_pending_events_update ON public.crm_pending_events
  FOR UPDATE
  TO authenticated
  USING (
    public.crm_phase1g_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('crm.audit.view')
    )
  )
  WITH CHECK (
    public.crm_phase1g_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('crm.audit.view')
    )
  );

-- No DELETE policy on pending events in Phase 1G.
