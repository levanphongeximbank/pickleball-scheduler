# Backlog — Canonical COACH Role Support (Post Phase 5)

**Program:** PICK_VN Canonical Navigation / Identity  
**Backlog ID:** `BL-P5-COACH-ROLE-SCHEMA`  
**Opened by:** Phase 5 Owner decision OD-P5-COACH = `APPROVED_PACKAGE_D_WAIVE`  
**Classification at open:** `WAIVED_WITH_KNOWN_SCHEMA_GAP`  
**Status:** **OPEN** — not in Phase 5 scope  
**Machine-readable:** [`PHASE5_BACKLOG_COACH_ROLE_SUPPORT.json`](./PHASE5_BACKLOG_COACH_ROLE_SUPPORT.json)

## Problem

The application defines canonical role `COACH` (`src/features/identity/constants/roles.js` + client permission matrix), but Staging currently:

1. Has **no** `public.roles` row for `COACH`
2. Excludes `COACH` from `public.profiles` check constraint `profiles_role_check`
3. Therefore cannot assign a Staging test identity with `profiles.role = 'COACH'` without schema/catalog changes

Phase 5 Preview acceptance **waives** COACH execution and will **not** perform role-schema remediation.

## Desired outcome (future workstream)

Make `COACH` a first-class Staging (then Production under separate GO) identity role:

1. Expand `profiles_role_check` to allow `'COACH'`
2. Insert `public.roles` catalog row `COACH`
3. Seed `public.role_permissions` for COACH (align with app matrix + COACHING-04 assigned.* grants as applicable)
4. Document promote path (signup → PLAYER → promote to COACH + `venue_id`)
5. Add Staging QA identity (non-Production) and regression cases
6. Separate Owner GOs: Staging schema → Staging fixture → Production (never bundled into nav Preview)

## Explicit non-goals for this backlog open

- No work in Canonical Navigation Phase 5 execution
- No Production schema/migration under this backlog until separate Production GO
- No credential publication

## Acceptance criteria (future)

- [ ] `COACH` present in `public.roles`
- [ ] `profiles_role_check` allows `COACH`
- [ ] Staging COACH test identity can login; app role normalizes to `COACH`
- [ ] `user_roles` sync succeeds for COACH
- [ ] Phase 5 waived cells can be re-run as PASS (optional follow-up QA)
- [ ] Rollback DDL documented

## References

- `docs/ui-ux/canonical-navigation/phase5/PHASE5_STAGING_IDENTITY_DISCOVERY.md` (Package C)
- `docs/ui-ux/canonical-navigation/phase5/PHASE5_IDENTITY_COVERAGE_OWNER_DECISIONS.md`
- `docs/coaching-training/coaching-04/40_COACHING_04_PERMISSION_SEED_AND_GRANTS.sql`
