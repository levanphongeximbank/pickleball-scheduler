-- =============================================================================
-- CLUBS-RLS-REMEDIATION-01 — FORWARD (Staging-first)
-- Blocker: B-CLUBS-RLS-01 — authenticated clubs_select OR status = 'active'
-- Parent audit: PLATFORM-FINAL-AUDIT-01
-- Locked baseline: adc43eb3979292a09687cf099404235583f7895e
--
-- Production deployment status: NOT APPLIED
-- Staging apply: Owner-gated only (see runbooks/STAGING_APPLY_RUNBOOK.md)
--
-- Scope:
--   - DROP/CREATE policy public.clubs → clubs_select only
--   - Does NOT alter writer grants / INSERT|UPDATE|DELETE policies (none exist)
--   - Does NOT alter public.public_catalog_list_clubs
--   - Does NOT alter SECURITY DEFINER club_* RPCs
-- =============================================================================

-- Safety: refuse if applied outside an Owner-approved session (manual gate).
-- Apply ONLY against Staging project ref qyewbxjsiiyufanzcjcq unless a separate
-- Production GO package is approved.

BEGIN;

DROP POLICY IF EXISTS clubs_select ON public.clubs;

CREATE POLICY clubs_select ON public.clubs
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.phase42_is_platform_super_admin()
      OR public.phase42_is_tenant_member(tenant_id)
      -- SECURITY DEFINER helper avoids RLS recursion with club_members_select
      -- (direct EXISTS on club_members re-enters club_members policies).
      OR public.phase42_active_club_member_id(id) IS NOT NULL
    )
  );

-- Keep SELECT grant for authenticated (unchanged Phase 42C contract).
GRANT SELECT ON public.clubs TO authenticated;

-- Writers remain revoked (idempotent reaffirmation — no expansion).
REVOKE INSERT, UPDATE, DELETE ON public.clubs FROM authenticated, anon;

COMMIT;

-- Forbidden predicates after apply (must NOT appear in clubs_select USING):
--   status = 'active'   (broad cross-tenant full-row discovery)
--
-- Allowed USING branches:
--   phase42_is_platform_super_admin()
--   phase42_is_tenant_member(tenant_id)
--   phase42_active_club_member_id(id) IS NOT NULL  (active member; SECURITY DEFINER)
--   deleted_at IS NULL (gate)
