-- =============================================================================
-- COACHING-04 — Permission seed + COACH role grants (PROPOSAL)
-- Purpose: Seed ONLY the five assigned.* permissions and grant them to COACH
--          when the role exists. Does NOT modify admin grants.
-- Status: PROPOSAL — AUTHORED ONLY. Do not apply without Owner GO.
--
-- Explicit:
--   - Do NOT grant coaching.records.read to COACH (club-wide admin semantics).
--   - PLAYER grants ABSENT due to COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED.
--   - Admin / venue / club role_permissions rows are NOT modified here.
-- =============================================================================

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- Seed catalog (WHERE NOT EXISTS) — module = coaching
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.assigned.read', 'coaching', 'assigned.read',
       'COACHING-04 assigned-scope read of coaching records'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.assigned.read');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.assigned.session.schedule', 'coaching', 'assigned.session.schedule',
       'COACHING-04 schedule/update sessions for own active coach reference'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.assigned.session.schedule');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.assigned.attendance.record', 'coaching', 'assigned.attendance.record',
       'COACHING-04 record attendance for assigned players on owned sessions'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.assigned.attendance.record');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.assigned.evaluation.submit', 'coaching', 'assigned.evaluation.submit',
       'COACHING-04 submit/update draft evaluations for assigned players'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.assigned.evaluation.submit');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.assigned.entitlement.consume', 'coaching', 'assigned.entitlement.consume',
       'COACHING-04 consume package entitlement for assigned players (RPC only)'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.assigned.entitlement.consume');

-- ---------------------------------------------------------------------------
-- Grant ONLY the five assigned.* permissions to role COACH (if present)
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'COACH', p.id
FROM public.permissions p
WHERE p.id IN (
  'coaching.assigned.read',
  'coaching.assigned.session.schedule',
  'coaching.assigned.attendance.record',
  'coaching.assigned.evaluation.submit',
  'coaching.assigned.entitlement.consume'
)
  AND EXISTS (SELECT 1 FROM public.roles r WHERE r.id = 'COACH')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = 'COACH' AND rp.permission_id = p.id
  );

-- Explicit NON-grants (do not uncomment / do not add):
--   coaching.records.read → COACH
--   any coaching.* → PLAYER
-- Reason PLAYER: COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED
-- Reason records.read: club-wide admin SELECT semantics under COACHING-02 RLS

-- OWNER APPROVAL GATE: Do not apply without review of
-- docs/coaching-training/coaching-04/00_COACHING_04_SCOPE_AND_SECURITY_MODEL.md
-- and docs/coaching-training/coaching-04/05_COACHING_04_ACCESS_MATRIX.md
