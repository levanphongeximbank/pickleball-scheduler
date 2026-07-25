-- =============================================================================
-- COACHING-03 — Role → permission assignment (PROPOSED — Owner review required)
-- Purpose: Idempotent grants into public.role_permissions for Coaching permissions.
-- Status: AUTHORED ONLY — do not execute until Gate C Owner GO + matrix approval.
-- Separately reviewable from COACHING-02 permission catalog seed (15_*).
-- Does NOT modify Identity internals / non-Coaching permissions.
-- Fail-closed:
--   - No PUBLIC / anon grants
--   - No COACH grants (RLS is permission+tenant/club only — assignment-aware
--     scope deferred to COACHING-04; club-wide COACH access must not be enabled)
--   - No PLAYER coaching grants (self-scope unproven — deferred COACHING-04)
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

-- Explicit non-grants (documented):
-- COACH — zero Coaching permissions until COACHING-04 assignment-aware RLS
-- PLAYER — zero Coaching permissions (self-service read deferred to COACHING-04)
-- STAFF, REFEREE, CASHIER, CUSTOMER, SUPPORT, ACCOUNTANT, SYSTEM_TECHNICIAN,
-- TOURNAMENT_MANAGER, TEAM_CAPTAIN — zero Coaching permissions by default.

-- OWNER APPROVAL GATE: Do not apply without signed review of
-- docs/coaching-training/coaching-03/02_COACHING_03_ROLE_PERMISSION_MATRIX.md
-- and Gate C token COACHING_03_OWNER_GO_APPLY_STAGING.
