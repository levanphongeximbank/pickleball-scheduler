-- =============================================================================
-- REPORTING-02 — Permission catalog seed rollback (scoped)
-- Purpose: Remove ONLY the 10 reporting.* permission catalog rows when safe.
-- Status: AUTHORED ONLY — run under Owner authorization after backup.
-- Does NOT DELETE from role_permissions. Does NOT touch unrelated permissions.
--
-- Refuse if any reporting seed id is still referenced by role_permissions
-- (unexpected grants must be cleared by Owner separately).
-- Target Staging only when authorized. Production prohibited unless separate GO.
-- =============================================================================

SET search_path = public, pg_temp;

DO $$
DECLARE
  v_blocked integer;
BEGIN
  SELECT COUNT(*)::integer
  INTO v_blocked
  FROM public.permissions p
  INNER JOIN public.role_permissions rp ON rp.permission_id = p.id
  WHERE p.id IN (
    'reporting.dashboard.view',
    'reporting.report.execute',
    'reporting.field.sensitive.view',
    'reporting.report.save',
    'reporting.filter.save',
    'reporting.report.export',
    'reporting.scope.cross_tenant',
    'reporting.scope.tenant',
    'reporting.scope.venue',
    'reporting.scope.club'
  );

  IF v_blocked > 0 THEN
    RAISE EXCEPTION
      'REPORTING_02_PERMISSION_SEED_ROLLBACK_REFUSED: % reporting permission id(s) still referenced by role_permissions. Clear unexpected role grants manually before seed rollback.',
      v_blocked
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.permissions
  WHERE id IN (
    'reporting.dashboard.view',
    'reporting.report.execute',
    'reporting.field.sensitive.view',
    'reporting.report.save',
    'reporting.filter.save',
    'reporting.report.export',
    'reporting.scope.cross_tenant',
    'reporting.scope.tenant',
    'reporting.scope.venue',
    'reporting.scope.club'
  );

  RAISE NOTICE 'REPORTING-02 permission catalog seed rollback completed (exact 10 ids)';
END $$;
