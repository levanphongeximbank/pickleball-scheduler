# 02 — Task and Follow-up Domain (Phase 1E)

**Status:** Application foundation
**Aggregate:** CrmTask

---

## Fields

| Field | Required | Notes |
|-------|----------|-------|
| `taskId` | yes | From `CrmIdGenerator` |
| `tenantId` / `venueId` | yes | Explicit scope |
| `contactRefId` | yes (commands) | Existing ContactReference |
| `leadId` / `opportunityId` | optional | Same contact |
| `sourceInteractionId` | optional | Same-scope Interaction; same contact |
| `title` | yes (commands) | Non-empty, max 200 |
| `description` | optional | Max 4000 |
| `status` | yes | `open` / `in_progress` / `completed` / `cancelled` |
| `priority` | yes | `low` / `normal` / `high` / `urgent` |
| `dueAt` | optional (general) / required future (follow-up) | ISO-8601 |
| `assignedToActorId` | optional | Via `IdentityActorPort` |
| `createdByActorId` | yes | Authenticated actor |
| `startedAt` / `completedAt` / `cancelledAt` | lifecycle | From `CrmClock` |
| `cancellationReason` | required on cancel | Non-empty |
| `createdAt` / `updatedAt` | yes | From `CrmClock` |

Phase 1B alias: `assigneeUserId` (= `assignedToActorId`).
Phase 1B `DONE` constant aliases `COMPLETED` (`"completed"`).

## Follow-up scheduling

`scheduleFollowUp`:

- Creates **one Task** aggregate only.
- Requires `dueAt` **strictly after** `CrmClock.nowIso()`.
- May link ContactReference / Lead / Opportunity / source Interaction.
- Must **not** create an Interaction automatically.
- Must **not** update Lead or Opportunity.
- Must **not** create Notification / Calendar / Finance records.
- Must **not** call email, SMS, or messaging providers.

## Missing `dueAt` listing rule

- General `createTask` may omit `dueAt`.
- Follow-ups must have a future `dueAt`.
- List ordering treats missing `dueAt` as **last** among peers
  (nulls-last via high sentinel), after non-terminal vs terminal grouping.
