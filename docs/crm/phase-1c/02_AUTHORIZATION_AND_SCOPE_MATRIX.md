# 02 — Authorization and Scope Matrix (Phase 1C)

**Status:** Fail-closed application enforcement on Phase 1B foundation

---

## Permission requirements

| Capability | Permission |
|------------|------------|
| Create ContactReference / Lead | `crm.lead.create` |
| Get / list Leads | `crm.lead.view` |
| Assign Lead owner | `crm.lead.assign` |

Role names are **not** permission proof. `VITE_RBAC_ENABLED` is **not** consulted.

---

## Scope matrix

| Condition | Result code |
|-----------|-------------|
| Missing actor / userId / actor.tenantId | `CRM_MISSING_ACTOR` |
| Actor `authenticated === false` | `CRM_UNAUTHORIZED` |
| Missing `tenantId` or `venueId` on command | `CRM_MISSING_SCOPE` |
| Missing required permission | `CRM_FORBIDDEN_PERMISSION` |
| Actor tenant ≠ command tenant | `CRM_FORBIDDEN_SCOPE` |
| Actor venueIds non-empty and venue not listed | `CRM_FORBIDDEN_SCOPE` |
| Loaded resource tenant/venue ≠ command scope | `CRM_FORBIDDEN_SCOPE` |
| Directory customer/player other scope | `CRM_FORBIDDEN_SCOPE` |
| Assignment target other tenant/venue | `CRM_FORBIDDEN_SCOPE` |
| Repository row leaked from other scope | `CRM_FORBIDDEN_SCOPE` |

No demo-club or default scope fallback.

---

## Directory-port behavior

| Port | Signature | Scope behavior |
|------|-----------|----------------|
| `VenueCustomerDirectoryPort` | `getById(scope, customerId)` | Returned record must match tenant+venue; missing → unresolved; mismatch → forbidden |
| `PlayerDirectoryPort` | `getById(scope, playerId)` | **Same as customer.** Callers must pass command scope. No unscoped `getById(playerId)`. Returned player must include matching `tenantId`+`venueId`. |
| `IdentityActorPort` | `resolveActor(scope, userId)` | Required for assign; inactive / wrong tenant / venue mismatch rejected |

Player resolution request is equivalent to `{ tenantId, venueId, playerId }` — all mandatory at the call site (scope object + playerId).
