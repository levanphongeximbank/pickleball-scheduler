-- =============================================================================
-- COACHING-03 — Role → permission assignment (PROPOSED — Owner review required)
-- Purpose: Idempotent grants into public.role_permissions for Coaching permissions.
-- Status: AUTHORED ONLY — do not execute until Gate C Owner GO + matrix approval.
-- Separately reviewable from COACHING-02 permission catalog seed (15_*).
-- Does NOT modify Identity internals / non-Coaching permissions.
-- Fail-closed:
--   - No PUBLIC / anon grants
--   - No PLAYER coaching.records.read (self-scope unproven — deferred COACHING-04)
--   - No PLAYER write actions
--   - No authenticated-global grant
--   - STAFF / REFEREE / CASHIER / CUSTOMER / SUPPORT receive zero by default
-- Convention: WHERE NOT EXISTS (CRM Phase 1H style)
-- =============================================================================

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- SUPER_ADMIN — all coaching.% catalog rows
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'SUPER_ADMIN', p.id
FROM public.permissions p
WHERE (p.module = 'coaching' OR p.id LIKE 'coaching.%')
  AND EXISTS (SELECT 1 FROM public.roles r WHERE r.id = 'SUPER_ADMIN')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = 'SUPER_ADMIN' AND rp.permission_id = p.id
  );

-- ---------------------------------------------------------------------------
-- TENANT_OWNER / VENUE_OWNER / COURT_OWNER — full Coaching ops
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM public.permissions p
CROSS JOIN (
  VALUES ('TENANT_OWNER'), ('VENUE_OWNER'), ('COURT_OWNER')
) AS r(role_id)
WHERE (p.module = 'coaching' OR p.id LIKE 'coaching.%')
  AND EXISTS (SELECT 1 FROM public.roles ro WHERE ro.id = r.role_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.role_id AND rp.permission_id = p.id
  );

-- ---------------------------------------------------------------------------
-- VENUE_MANAGER / COURT_MANAGER — full Coaching ops (venue-scoped via RLS)
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM public.permissions p
CROSS JOIN (
  VALUES ('VENUE_MANAGER'), ('COURT_MANAGER')
) AS r(role_id)
WHERE (p.module = 'coaching' OR p.id LIKE 'coaching.%')
  AND EXISTS (SELECT 1 FROM public.roles ro WHERE ro.id = r.role_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.role_id AND rp.permission_id = p.id
  );

-- ---------------------------------------------------------------------------
-- CLUB_MANAGER / CLUB_OWNER — full Coaching ops (club-scoped via RLS)
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM public.permissions p
CROSS JOIN (
  VALUES ('CLUB_MANAGER'), ('CLUB_OWNER')
) AS r(role_id)
WHERE (p.module = 'coaching' OR p.id LIKE 'coaching.%')
  AND EXISTS (SELECT 1 FROM public.roles ro WHERE ro.id = r.role_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.role_id AND rp.permission_id = p.id
  );

-- ---------------------------------------------------------------------------
-- COACH — operational subset (no program design, no corrections, no package/grant)
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'COACH', v.permission_id
FROM (
  VALUES
    ('coaching.player.enroll'),
    ('coaching.lesson.create'),
    ('coaching.session.schedule'),
    ('coaching.attendance.record'),
    ('coaching.entitlement.consume'),
    ('coaching.evaluation.submit'),
    ('coaching.records.read')
) AS v(permission_id)
WHERE EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = v.permission_id)
  AND EXISTS (SELECT 1 FROM public.roles ro WHERE ro.id = 'COACH')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = 'COACH' AND rp.permission_id = v.permission_id
  );

-- Explicit non-grants (documented):
-- PLAYER — zero Coaching permissions (self-service read deferred to COACHING-04)
-- STAFF, REFEREE, CASHIER, CUSTOMER, SUPPORT, ACCOUNTANT, SYSTEM_TECHNICIAN,
-- TOURNAMENT_MANAGER, TEAM_CAPTAIN — zero Coaching permissions by default.

-- OWNER APPROVAL GATE: Do not apply without signed review of
-- docs/coaching-training/coaching-03/02_COACHING_03_ROLE_PERMISSION_MATRIX.md
-- and Gate C token COACHING_03_OWNER_GO_APPLY_STAGING.
