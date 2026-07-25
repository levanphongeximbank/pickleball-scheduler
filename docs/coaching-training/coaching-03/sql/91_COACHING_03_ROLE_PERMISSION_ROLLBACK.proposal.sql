-- =============================================================================
-- COACHING-03 — Role permission rollback (PROPOSED)
-- Purpose: Remove Coaching role_permissions rows introduced by 70_* proposal.
-- Status: AUTHORED ONLY — Owner-authorized manual run. Not auto-executed.
-- Does NOT drop permission catalog rows (those belong to COACHING-02 seed).
-- Does NOT touch non-Coaching role_permissions.
-- =============================================================================

SET search_path = public, pg_temp;

DELETE FROM public.role_permissions rp
USING public.permissions p
WHERE rp.permission_id = p.id
  AND (p.module = 'coaching' OR p.id LIKE 'coaching.%')
  AND rp.role_id IN (
    'SUPER_ADMIN',
    'TENANT_OWNER',
    'VENUE_OWNER',
    'COURT_OWNER',
    'VENUE_MANAGER',
    'COURT_MANAGER',
    'CLUB_MANAGER',
    'CLUB_OWNER',
    'COACH'
  );
