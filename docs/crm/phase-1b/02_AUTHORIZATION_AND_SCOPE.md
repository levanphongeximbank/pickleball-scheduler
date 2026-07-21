# 02 — Authorization and Scope (Phase 1B)

**Status:** Foundation only — not Production-wired

---

## Rules

1. Require authenticated actor (`userId`, `tenantId`; `authenticated !== false`).
2. Require explicit `tenantId` + `venueId` on every command/resource.
3. Fail closed when actor, scope, or permission is missing.
4. Reject cross-tenant and cross-venue operations.
5. Actor `venueIds` (when non-empty) must include command `venueId`.
6. Permission must be a known `crm.*` key and present on actor.
7. Do **not** read `VITE_RBAC_ENABLED` or other env vars inside domain authorization.
8. Do **not** treat `customer.view` as proof of CRM mutation rights.

## APIs

- `requireCrmActor`
- `requireCrmScope` / `assertCrmScopeMatch`
- `authorizeCrm` / `authorizeCrmResource`

## Non-goals

- Identity SQL seeds
- Route PermissionGate migration to `crm.*`
- Production RBAC matrix updates
