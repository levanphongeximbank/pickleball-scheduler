# Phase 1C — Production Owner-Assign Authz Gate Preflight (READ-ONLY)

- **Verdict:** READY_WITH_WARNINGS
- **Production ref:** `expuvcohlcjzvrrauvud` (confirmed)
- **Not Staging:** `qyewbxjsiiyufanzcjcq`
- **Approved app SHA:** `827a71c50eaf744c77b1e31afbfc774c6241d388`
- **origin/main:** `827a71c50eaf744c77b1e31afbfc774c6241d388`
- **SQL applied:** false
- **Deploy performed:** false
- **Mutations:** false

## Current RPC authorization

- `club_assign_owner` uses bare `phase42_is_tenant_member`: **true**
- `club_clear_owner` uses bare `phase42_is_tenant_member`: **true**
- Narrow helper `phase42_can_assign_club_owner` exists: **false**
- SECURITY DEFINER assign/clear: **true** / **true**
- EXECUTE grant authenticated: assign **true**, clear **true**
- RLS enabled on clubs: **true**

## Excessive Production access (current)

- tenant_staff
- VENUE_MANAGER (profile fallback)
- COURT_MANAGER (profile fallback)

## Compatibility

- Tables/columns OK: true
- Dependencies OK: true
- Audit accepts club.assign_owner / club.clear_owner: true
- Data rewrite required: false
- Gate SQL CREATE OR REPLACE safe: true
- Optional Club Owner self-transfer enabled in gate file: false

## Rollback readiness

- Ready: true
- Restores prior function bodies only; no audit delete; no app revert

## Apply order (DO NOT EXECUTE in this step)

1. Capture current Production function definitions (club_assign_owner, club_clear_owner, phase42_can_assign_club_owner if any)
2. Apply docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql to Production ONLY after Owner GO
3. Catalog verification: helper exists; assign/clear use phase42_can_assign_club_owner; no bare phase42_is_tenant_member; optional club_owner path absent; RLS still enabled
4. Live authorization smoke (ALLOW: SUPER_ADMIN, tenant_owner, approved tenant admin; DENY: tenant_staff, VENUE_MANAGER, COURT_MANAGER, Club Owner alone, President, VP, player, unrelated, anonymous)
5. Verify VERSION_CONFLICT + MEMBER_REQUIRED + version bump + audit for assign/clear
6. Confirm app UI consistency (transfer hidden for Club Owner alone; assign/clear succeed for tenant owner/SA)
7. Roll back with PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_ROLLBACK.sql only if allowed actor incorrectly denied or system mutation fails

## Warnings

- SECURITY RISK ACTIVE: Production assign/clear still broad via phase42_is_tenant_member

## Evidence

- `docs\v5\qa-evidence\phase1c-production\PHASE_1C_PRODUCTION_AUTHZ_GATE_PREFLIGHT.json`
- `docs\v5\qa-evidence\phase1c-production\PHASE_1C_PRODUCTION_AUTHZ_GATE_PREFLIGHT.md`
- Staging: `docs/v5/qa-evidence/phase1c-staging/CLUB_OWNER_ASSIGN_AUTHZ_GATE_REPORT.json`
- Gate: `docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql`
- Rollback: `docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_ROLLBACK.sql`
