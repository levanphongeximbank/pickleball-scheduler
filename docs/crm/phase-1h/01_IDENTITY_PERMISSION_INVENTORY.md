# 01 — Identity Permission Inventory (CRM Phase 1H-A)

**Status:** Offline audit complete. No SQL applied. No live database connection.

## Verdict

CRM permissions already exist as canonical JS constants (`crm.*`). They are **not** yet seeded into Identity SQL. Phase 1H-A extends the existing Identity catalog (`public.permissions` / `public.role_permissions`) — it does **not** invent a parallel RBAC system.

## Canonical permission constants

| Layer | Path | Notes |
|-------|------|-------|
| Identity SoT (platform) | `src/features/identity/constants/permissions.js` | `resource.action`; no `crm.*` today |
| Identity matrix | `src/features/identity/matrix/rolePermissions.js` | Client mirror of DB matrix |
| Roles | `src/features/identity/constants/roles.js` | `SUPER_ADMIN` → `PLATFORM_ADMIN` alias |
| CRM SoT strings | `src/features/crm/constants/permissions.js` | `CRM_PERMISSIONS` / `CRM_PERMISSION_VALUES` |

CRM naming: `crm.<entity>.<action>` (three+ segments), matching platform dotted format without colliding with legacy `customer.*`.

## How role_permissions are seeded

Primary mechanism: **SQL** additive patches (not JSON, not JS runtime upserts).

Exemplars:

- `docs/supabase-identity-v40-sprint1.sql` — `ON CONFLICT (id) DO NOTHING`
- `docs/v5/PHASE_42I_MEMBERSHIP_REVIEW.sql` — `WHERE NOT EXISTS` (preferred newer style)
- `docs/v5/PHASE_23C_PRODUCTION_PERMISSIONS_PATCH.sql` — feature permission patches

JS `ROLE_PERMISSIONS` is a client/runtime mirror, not the DB seeder.

## Idempotent seed conventions

1. Insert into `public.permissions` first (FK).
2. Use `WHERE NOT EXISTS` or `ON CONFLICT DO NOTHING`.
3. Insert `role_permissions` only when permission + role rows exist.
4. Never wipe the matrix.

Phase 1H-A uses **WHERE NOT EXISTS** and separates:

- `10_CRM_PHASE_1H_PERMISSION_SEED.sql` — catalog only
- `20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql` — grants (Owner review)

## Tenant / venue authorization helpers (verified)

| Helper | Source | Behavior |
|--------|--------|----------|
| `is_super_admin()` | `docs/supabase-rbac.sql` | `profiles.role = 'SUPER_ADMIN'` + active |
| `user_venue_id()` | same | `profiles.venue_id` for `auth.uid()` |
| `user_has_permission(text)` | `docs/supabase-rbac-v4.sql` | Super-admin OR role matrix |
| `crm_phase1g_scope_allows` | Phase 1G RLS | Both tenant_id and venue_id equal `user_venue_id()` |

**No verified `user_tenant_id()` distinct from venue.**

## SUPER_ADMIN / internal service rules

- DB: `is_super_admin()` short-circuits permission checks; foundation seed grants SUPER_ADMIN all permissions.
- App: `PLATFORM_ADMIN` / `SUPER_ADMIN` aliases via `normalizeRole`.
- CRM app `authorizeCrm` does **not** auto-bypass — actor must list `crm.*` (stricter than DB for memory tests).
- `service_role` worker grants remain deferred (Phase 1H+ / 1I).

## CRM operator role

**Does not exist.** No `CRM_OPERATOR` in Identity roles or SQL seeds. Phase 1H-A does not invent one.

Closest venue ops roles: `TENANT_OWNER` / `VENUE_OWNER` / `COURT_OWNER`, `VENUE_MANAGER`, optionally limited `STAFF`.

## Existing CRM SQL seeds

**None.** Grep of `docs/**/*.sql` finds zero `crm.*` inserts into `permissions` prior to Phase 1H-A authoring.

## Recommendation implemented

- Seed under `docs/crm/phase-1h/` using Identity conventions.
- Keep string SoT in `src/features/crm/constants/permissions.js`.
- Do not modify Identity JS matrix in Phase 1H-A (apply-time alignment deferred to Owner-approved later phase to avoid silent broad client grants).
- Permission creation and role assignment remain separately reviewable.
