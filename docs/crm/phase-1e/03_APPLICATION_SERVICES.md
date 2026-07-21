# 03 — Application Services (Phase 1E)

**Status:** Application foundation
**Consistency model:** MODEL 1 — COMMAND RETURNS EVENTS

---

## Factories

| Factory | Path |
|---------|------|
| `createInteractionApplicationService` | `src/features/crm/services/interactionApplicationService.js` |
| `createTaskApplicationService` | `src/features/crm/services/taskApplicationService.js` |

## Interaction commands

| Command | Permission | Aggregate write |
|---------|------------|-----------------|
| `recordInteraction` | `crm.interaction.create` | Interaction create |
| `getInteraction` | `crm.interaction.view` | none |
| `listInteractions` | `crm.interaction.view` | none |

### `listInteractions` filters

`contactRefId`, `leadId`, `opportunityId`, `interactionType`, `direction`,
`channel`, `occurredFrom`, `occurredTo`.

## Task commands

| Command | Permission | Aggregate write |
|---------|------------|-----------------|
| `createTask` | `crm.task.create` | Task create |
| `scheduleFollowUp` | `crm.task.create` | Task create |
| `getTask` | `crm.task.view` | none |
| `listTasks` | `crm.task.view` | none |
| `assignTask` | `crm.task.assign` | Task update |
| `rescheduleTask` | `crm.task.update` | Task update |
| `startTask` | `crm.task.update` | Task update |
| `completeTask` | `crm.task.update` | Task update |
| `cancelTask` | `crm.task.update` | Task update |

### `listTasks` filters

`contactRefId`, `leadId`, `opportunityId`, `assignedToActorId`, `status`,
`priority`, `dueFrom`, `dueTo`, `overdueOnly`.

### Deterministic task order

1. Non-terminal before terminal
2. `dueAt` ascending (missing last)
3. `createdAt` ascending
4. `taskId` ascending

## MODEL 1 command sequence

1. Validate request
2. Validate actor + permission + scope
3. Resolve same-scope references
4. Build next aggregate state
5. Construct pending event envelopes
6. Validate envelopes
7. Perform **one** aggregate write
8. Return aggregate + `pendingApplicationEvents` (`delivery: "pending"`)

## Explicit non-goals

- Persist events as delivered
- Best-effort compensating rollback
- Multi-aggregate writes
- Notification / Calendar / Finance / messaging side effects
- Lead or Opportunity mutation as a side effect of Interaction/Task commands
