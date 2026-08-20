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
--   - Reaffirm RPC-only writes: no INSERT|UPDATE|DELETE|ALL writer policies
--   - REVOKE INSERT, UPDATE, DELETE, TRUNCATE from authenticated, anon on public.clubs
--   - REVOKE TRUNCATE from authenticated, anon on remaining Club-owned tables
--   - Does NOT alter service_role, PUBLIC default ACL, or FORCE RLS
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

-- Writers remain revoked (idempotent reaffirmation — include TRUNCATE; RLS does not protect it).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.clubs FROM authenticated, anon;
REVOKE TRUNCATE ON public.club_members FROM authenticated, anon;
REVOKE TRUNCATE ON public.club_governance_assignments FROM authenticated, anon;
REVOKE TRUNCATE ON public.club_membership_requests_v42 FROM authenticated, anon;

COMMIT;

-- Forbidden predicates after apply (must NOT appear in clubs_select USING):
--   status = 'active'   (broad cross-tenant full-row discovery)
--
-- Allowed USING branches:
--   phase42_is_platform_super_admin()
--   phase42_is_tenant_member(tenant_id)
--   phase42_active_club_member_id(id) IS NOT NULL  (active member; SECURITY DEFINER)
--   deleted_at IS NULL (gate)
