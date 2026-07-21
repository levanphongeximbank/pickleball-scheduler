-- =============================================================================
-- CRM Phase 1H — Role → permission assignment (PROPOSED — Owner review required)
-- Purpose: Idempotent grants into public.role_permissions for CRM permissions.
-- Status: AUTHORED ONLY — do not apply in Phase 1H-A.
-- SEPARATELY REVIEWABLE from 10_CRM_PHASE_1H_PERMISSION_SEED.sql.
-- Owner approval REQUIRED before any Staging/Production apply.
--
-- Fail-closed:
--   - No PUBLIC / anon grants
--   - No PLAYER / CUSTOMER CRM administration
--   - No authenticated-global grant
--   - No invented CRM_OPERATOR role
--   - Venue roles remain JWT venue-scoped via RLS (not granted here as global)
-- Convention: WHERE NOT EXISTS (Phase 42I style)
-- =============================================================================

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- SUPER_ADMIN — platform convention: all crm.% catalog rows
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'SUPER_ADMIN', p.id
FROM public.permissions p
WHERE p.module = 'crm'
  AND EXISTS (SELECT 1 FROM public.roles r WHERE r.id = 'SUPER_ADMIN')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = 'SUPER_ADMIN' AND rp.permission_id = p.id
  );

-- ---------------------------------------------------------------------------
-- TENANT_OWNER / VENUE_OWNER / COURT_OWNER — full CRM ops
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM public.permissions p
CROSS JOIN (
  VALUES ('TENANT_OWNER'), ('VENUE_OWNER'), ('COURT_OWNER')
) AS r(role_id)
WHERE p.module = 'crm'
  AND EXISTS (SELECT 1 FROM public.roles ro WHERE ro.id = r.role_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.role_id AND rp.permission_id = p.id
  );

-- ---------------------------------------------------------------------------
-- VENUE_MANAGER / COURT_MANAGER — ops without campaign.manage / pipeline.manage
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM public.permissions p
CROSS JOIN (
  VALUES ('VENUE_MANAGER'), ('COURT_MANAGER')
) AS r(role_id)
WHERE p.module = 'crm'
  AND p.id NOT IN ('crm.campaign.manage', 'crm.pipeline.manage')
  AND EXISTS (SELECT 1 FROM public.roles ro WHERE ro.id = r.role_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.role_id AND rp.permission_id = p.id
  );

-- ---------------------------------------------------------------------------
-- STAFF — limited create/view (no assign/admin/consent revoke/audit)
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'STAFF', v.permission_id
FROM (
  VALUES
    ('crm.lead.view'),
    ('crm.lead.create'),
    ('crm.opportunity.view'),
    ('crm.interaction.view'),
    ('crm.interaction.create'),
    ('crm.task.view'),
    ('crm.task.create'),
    ('crm.tag.view'),
    ('crm.consent.view'),
    ('crm.campaign.view')
) AS v(permission_id)
WHERE EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = v.permission_id)
  AND EXISTS (SELECT 1 FROM public.roles ro WHERE ro.id = 'STAFF')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = 'STAFF' AND rp.permission_id = v.permission_id
  );

-- Explicit non-grants (documented): PLAYER, CUSTOMER, REFEREE, COACH, CASHIER,
-- TEAM_CAPTAIN, TOURNAMENT_MANAGER, CLUB_MANAGER, SUPPORT, ACCOUNTANT,
-- SYSTEM_TECHNICIAN — receive zero CRM permissions by default.

-- OWNER APPROVAL GATE: Do not apply this file without signed Owner review of
-- docs/crm/phase-1h/02_CRM_PERMISSION_SEED_AND_ROLE_MATRIX.md.
