# 04 — Authorization, Scope, and Relationships (Phase 1E)

**Status:** Checklist / matrix

---

## Permissions

| Permission code | Used by |
|-----------------|---------|
| `crm.interaction.create` | `recordInteraction` |
| `crm.interaction.view` | `getInteraction`, `listInteractions` |
| `crm.task.create` | `createTask`, `scheduleFollowUp` |
| `crm.task.view` | `getTask`, `listTasks` |
| `crm.task.update` | `rescheduleTask`, `startTask`, `completeTask`, `cancelTask` |
| `crm.task.assign` | `assignTask` |

Role names are **not** permission evidence. Authorization remains fail-closed.

## Rejected cases (all commands)

| Scenario | Typical code |
|----------|--------------|
| Missing actor | `CRM_MISSING_ACTOR` / `CRM_UNAUTHORIZED` |
| Missing tenantId / venueId | `CRM_MISSING_SCOPE` |
| Missing permission | `CRM_FORBIDDEN_PERMISSION` |
| Cross-tenant / cross-venue | `CRM_FORBIDDEN_SCOPE` |
| Missing related aggregate | `CRM_NOT_FOUND` |
| Invalid relationship (mismatched contact) | `CRM_INVALID_INPUT` |
| Invalid lifecycle transition | `CRM_INVALID_TRANSITION` |
| Invalid assignment target | `CRM_NOT_FOUND` / `CRM_FORBIDDEN_SCOPE` / `CRM_INVALID_INPUT` |

## Relationship validation

For Interaction and Task writes:

1. Authenticated actor + required CRM permission
2. Explicit tenant + venue scope
3. ContactReference exists in the **same** scope (no silent create)
4. Optional Lead exists in same scope and shares `contactRefId`
5. Optional Opportunity exists in same scope and shares `contactRefId`
6. Optional Lead + Opportunity refer to the **same** `contactRefId`
7. Optional source Interaction (tasks) exists in same scope and shares `contactRefId`
8. No cross-tenant or cross-venue relationship acceptance

## Assignment targets

`IdentityActorPort.resolveActor(scope, userId)` must:

- Resolve an actor
- Confirm `active !== false`
- Confirm same tenant
- Confirm venue membership when `venueIds` is non-empty

Cross-scope targets fail closed.
