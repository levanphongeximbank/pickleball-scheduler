# COACHING-02 — Durable Persistence Architecture

## Ownership (from COACHING-01)

Coaching owns persistence for: program, coach reference, coach–player relationship, enrollment, curriculum, lesson, training session (+ embedded schedule), attendance, attendance correction, package, entitlement, package usage events, evaluation (revisions via new rows).

**Does not own / does not copy:** coach Identity profile, Player profile, Club profile, Venue/Court records, Finance invoice/payment/refund, Notification delivery.

**Typed references only (deferred RI — no FK to external module tables):**
`tenant_id`, `club_id`, `venue_id`, `court_id` (schedule), `coach_principal_id`, `coach_membership_id`, `player_id`, `external_payment_reference`.

## Why no separate `coaching_session_schedules` table

COACHING-01 models `SessionSchedule` as an embedded value object on `TrainingSession`. Canonical persistence stores schedule columns on `coaching_training_sessions`. Coverage is complete without a separate entity.

## Why no separate `coaching_evaluation_revisions` table

Domain revisions create a **new** evaluation aggregate with `revisesEvaluationId`. One `coaching_evaluations` table + submitted immutability trigger is sufficient.

## Optimistic concurrency

Every mutable aggregate has `version integer CHECK (version >= 1)`. Updates require `expectedVersion` matching current row; zero updated rows → `COACHING_VERSION_CONFLICT`. No blind retries. No silent overwrite of newer versions.

## Append-only

| Table | Rule |
|-------|------|
| `coaching_attendance_corrections` | INSERT only; trigger blocks UPDATE/DELETE |
| `coaching_package_usage_events` | INSERT only; unique idempotency key; trigger blocks UPDATE/DELETE |
| Submitted `coaching_evaluations` | Trigger blocks UPDATE/DELETE when `status = submitted` |

Lifecycle **archive** preferred over destructive delete. No cascade-delete of business history.

## Adapter conventions

| Concern | Convention |
|---------|------------|
| Client | Injected `CoachingDatabaseClientPort` — no singleton, no env read |
| Path | `src/features/coaching/persistence/` |
| Mapping | Explicit snake_case ↔ camelCase mappers |
| Errors | `translateCoachingPersistenceError` → `CoachingError` codes |
| Scope | Every query filters `tenant_id` + `club_id`; missing scope fail-closed |
| Ordering | Deterministic by entity id then `created_at` |
| Runtime | **Not** wired as application default |

## Atomic boundaries

1. `coaching_apply_attendance_correction` — single RPC for UoW.applyCorrection  
2. `coaching_consume_entitlement` — entitlement update + usage append + idempotency  

Adapter calls **one** RPC per atomic operation (no two-network-request split).

## External referential integrity

Deferred. Insufficient evidence that external table names / delete semantics are stable and convention-approved for FK coupling. Documented for COACHING-03+ Owner review.
