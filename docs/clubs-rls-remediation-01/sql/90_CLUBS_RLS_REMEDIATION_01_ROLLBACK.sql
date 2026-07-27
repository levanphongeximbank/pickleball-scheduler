-- =============================================================================
-- CLUBS-RLS-REMEDIATION-01 — ROLLBACK
-- Restores pre-remediation clubs_select INCLUDING the broad OR status = 'active'
-- branch (Phase 42C historical). Use ONLY to abort Staging if needed.
--
-- Production: do not use unless Production forward was applied (it was not).
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS clubs_select ON public.clubs;

CREATE POLICY clubs_select ON public.clubs
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.phase42_is_platform_super_admin()
      OR public.phase42_is_tenant_member(tenant_id)
      OR status = 'active'
      OR EXISTS (
        SELECT 1
        FROM public.club_members cm
        WHERE cm.club_id = clubs.id
          AND cm.user_id = auth.uid()
          AND cm.status = 'active'
      )
    )
  );

GRANT SELECT ON public.clubs TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.clubs FROM authenticated, anon;

COMMIT;
