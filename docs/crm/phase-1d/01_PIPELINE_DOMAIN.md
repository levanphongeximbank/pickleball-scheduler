# 01 — Pipeline Domain (Phase 1D)

**Status:** Application foundation

---

## Ownership and scope

- Pipeline is a CRM aggregate owned by CRM.
- Every Pipeline requires explicit `tenantId` and `venueId`.
- No silent defaults. No `demo-club` or default scope.
- Pipeline codes are normalized deterministically (`normalizePipelineCode`).
- Codes must be unique within one tenant+venue scope.

## Fields

| Field | Notes |
|-------|-------|
| `pipelineId` | Required; generated via `CrmIdGenerator` when not supplied |
| `tenantId` / `venueId` | Mandatory |
| `name` | Display name |
| `code` | Normalized unique code within scope |
| `stages` | Ordered `PipelineStage` list |
| `allowedTransitions` | Explicit open-stage edges (default: consecutive open stages) |
| `active` | Inactive pipelines cannot start new Opportunities |
| `createdAt` / `updatedAt` | ISO timestamps via `CrmClock` |

## PipelineStage

| Field | Notes |
|-------|-------|
| `stageId` / `code` | Stable identity; codes unique within Pipeline |
| `name` / `label` | Display only — never used to derive transitions |
| `sortOrder` / `order` | Deterministic ordering |
| `category` | `open` \| `won` \| `lost` |
| `isTerminal` | Won/lost are terminal |

## Minimum stage semantics

- At least one **open** stage.
- Exactly one **won** terminal stage.
- Exactly one **lost** terminal stage.
- Terminal stages cannot have outgoing transitions.
- Default stage codes reuse Phase 1B `OPPORTUNITY_STAGE` constants.

## Non-goals

- UI pipeline board
- Durable SQL persistence
- Automatic campaign triggers on stage change
