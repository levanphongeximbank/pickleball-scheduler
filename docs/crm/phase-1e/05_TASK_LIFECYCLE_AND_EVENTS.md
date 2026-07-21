# 05 — Task Lifecycle and Events (Phase 1E)

**Status:** Application foundation

---

## Allowed transitions

| From | To |
|------|----|
| `open` | `in_progress`, `completed`, `cancelled` |
| `in_progress` | `completed`, `cancelled` |
| `completed` | _(none)_ |
| `cancelled` | _(none)_ |

Terminal states: `completed`, `cancelled`.

## Lifecycle rules

- No outgoing transition from a terminal task.
- No silent reopening in Phase 1E.
- `startTask` sets `startedAt` (keeps existing if already set).
- `completeTask` sets `completedAt` (and `startedAt` if missing).
- `cancelTask` requires non-empty `cancellationReason` and sets `cancelledAt`.
- All timestamps come from `CrmClock`.
- No direct status assignment outside explicit application commands.

## Pending audit event types

| Event type code | Emitted by |
|-----------------|------------|
| `crm.audit.interaction.recorded` | `recordInteraction` |
| `crm.audit.task.created` | `createTask` |
| `crm.audit.follow_up.scheduled` | `scheduleFollowUp` |
| `crm.audit.task.assigned` | `assignTask` |
| `crm.audit.task.rescheduled` | `rescheduleTask` |
| `crm.audit.task.started` | `startTask` |
| `crm.audit.task.completed` | `completeTask` |
| `crm.audit.task.cancelled` | `cancelTask` |

Payloads contain identifiers and safe workflow metadata only.

## Payload exclusions

- Full Customer / Player profiles
- Credentials / tokens
- Payment data
- Authoritative Finance records
- Message-provider secrets

## Delivery semantics

Envelopes are returned as:

```js
{ kind: "audit", delivery: "pending", event }
```

They are **not** persisted as delivered and are **not** dispatched in Phase 1E.
