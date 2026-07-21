# 02 — Tag Assignment Services (Phase 1F)

**Status:** Implemented

---

## TagAssignment aggregate

| Field | Required |
|-------|----------|
| `assignmentId` | yes |
| `tenantId` | yes |
| `venueId` | yes |
| `tagId` | yes |
| `targetType` | yes |
| `targetId` | yes |
| `assignedByActorId` | yes |
| `assignedAt` | yes |

## Approved target types

- `CONTACT_REFERENCE`
- `LEAD`
- `OPPORTUNITY`

## Application commands

| Command | Permission | Aggregate write |
|---------|------------|-----------------|
| `createTag` | `crm.tag.create` | Tag |
| `getTag` / `listTags` | `crm.tag.view` | none |
| `activateTag` / `deactivateTag` | `crm.tag.update` | Tag |
| `assignTag` / `removeTag` | `crm.tag.assign` | TagAssignment |
| `listTagsForTarget` / `listTargetsByTag` | `crm.tag.view` | none |

## Rules

- Tag and target must belong to the same tenant/venue
- Duplicate active assignment is idempotent (returns existing assignment)
- Removing assignment does not delete the Tag definition
- No propagation between Contact, Lead, and Opportunity
- Missing targets fail closed — no silent aggregate creation

## Events

- `crm.audit.tag.created`
- `crm.audit.tag.activated` / `crm.audit.tag.deactivated`
- `crm.audit.tag.assigned` / `crm.audit.tag.removed`
