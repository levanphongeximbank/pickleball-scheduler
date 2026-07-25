# COACHING-01 — Canonical Domain, Authorization & Persistence Boundary Foundation

**Phase:** COACHING-01  
**Module:** `src/features/coaching/`  
**Public barrel:** `src/features/coaching/index.js`  
**Tests:** `tests/coaching-01-domain-foundation.test.js`, `tests/coaching-platform-adoption.test.js`  
**Status:** Implemented foundation (not Production-wired; no durable persistence)

---

## Canonical ownership

Coaching & Training owns:

- coaching program
- coach reference boundary
- coach–player relationship
- enrollment
- curriculum / lesson
- training session + session scheduling intent
- attendance + append-only attendance correction
- coaching package definition + entitlement/usage
- evaluation (+ explicit revision contract)
- explicit tenant/club/(optional venue) scope
- lifecycle/status + version/concurrency
- typed Coaching errors

Does **not** own:

| Concern | Owner |
|---------|-------|
| Coach principal / user identity | Identity / Platform Core |
| Club membership & coach role | Club Management |
| Player profile | Player Management |
| Club | Club Management |
| Venue / court / availability | Venue & Court |
| Invoice / payment / refund / settlement | Finance |
| Notification delivery | Notification |

Coaching stores typed references only (`coachPrincipalId`, `coachMembershipId`, `playerId`, `clubId`, `tenantId`, `venueId`, `courtId`, `externalPaymentReference`).

---

## Aggregate boundaries

| Aggregate | Identity field | Notes |
|-----------|----------------|-------|
| CoachingProgram | `programId` | Lifecycle: draft→active→suspended→completed→archived |
| CoachReference | `coachReferenceId` | Typed principal/membership refs |
| CoachPlayerRelationship | `relationshipId` | Coach↔player link |
| CoachingEnrollment | `enrollmentId` | playerId + programId |
| Curriculum | `curriculumId` | |
| Lesson | `lessonId` | Ordered under curriculum |
| TrainingSession | `sessionId` | Embeds SessionSchedule intent |
| AttendanceRecord | `attendanceId` | |
| AttendanceCorrection | `correctionId` | Append-only |
| CoachingPackage | `packageId` | Definition + session entitlement |
| PackageEntitlement | `entitlementId` | Usage/consumption |
| CoachingEvaluation | `evaluationId` | Draft→submitted; revision = new record |

Every mutable aggregate carries: `tenantId`, `clubId`, optional `venueId`, `status`, `createdAt`, `updatedAt`, `version`.

---

## Lifecycle

See `src/features/coaching/constants/lifecycles.js` for allow-lists. Invalid transitions throw `COACHING_INVALID_TRANSITION`.

Attendance corrections never silently overwrite history: previous/corrected values, reason, actor, and `correctedAt` are persisted as append-only correction rows.

Submitted evaluations cannot be silently overwritten; use `createEvaluationRevision` / `revisesEvaluationId`.

---

## Authorization actions

| Action | Purpose |
|--------|---------|
| `coaching.program.create` | Create program |
| `coaching.program.update` | Update / transition program |
| `coaching.coach.assign` | Assign coach reference (+ optional relationship) |
| `coaching.player.enroll` | Enroll / transition enrollment |
| `coaching.curriculum.create` | Create curriculum |
| `coaching.lesson.create` | Create lesson |
| `coaching.session.schedule` | Schedule / transition session |
| `coaching.attendance.record` | Record attendance |
| `coaching.attendance.correct` | Atomic attendance correction |
| `coaching.package.create` | Create coaching package definition |
| `coaching.entitlement.grant` | Grant package entitlement to a player |
| `coaching.entitlement.consume` | Consume one session from entitlement |
| `coaching.evaluation.submit` | Submit / revise evaluation |
| `coaching.records.read` | Protected read |

Dedicated package/entitlement actions are **not** aliases of program/enroll/attendance actions. Holding `coaching.program.create` does **not** authorize `createPackage`; holding `coaching.player.enroll` does **not** authorize `grantEntitlement`; holding `coaching.attendance.record` does **not** authorize `consumeEntitlement`.

Fail-closed when actor missing, scope missing, unknown action, cross-tenant/club, missing authorization dependency, or malformed decision.

Authorization runs in the application layer **before** repository write/protected read. Menu/route guards are not evidence of authorization.

---

## Repository ports

Ports: Program, CoachReference, Relationship, Enrollment, Curriculum, Lesson, Session, Attendance, AttendanceCorrection (append-only), **AttendanceCorrectionUnitOfWork** (atomic correction), Package, Entitlement, Evaluation.

In-memory adapters: `createInMemoryCoachingRepositories()`.

Contracts: tenant/club scoping, not-found, duplicate, `expectedVersion` optimistic concurrency, deterministic ordering, append-only corrections.

### Atomic attendance correction

Application services MUST call `attendanceCorrectionUnitOfWork.applyCorrection({ scope, attendance, correction, expectedVersion })` as a **single** repository boundary. They MUST NOT `attendance.save` then `attendanceCorrections.append` as two independent operations.

In-memory adapter rolls back the attendance write if correction append fails (attendance unchanged; no correction row). Successful apply increments attendance `version` by exactly one and appends one correction.

**COACHING-02 durable adapter requirement:** implement the same transactional boundary (SQL transaction / RPC) so attendance update and correction append commit or roll back together.

**No Supabase durable adapter in COACHING-01.**

---

## Version / concurrency

Updates require `expectedVersion` matching current `version`. Successful updates increment `version` by exactly 1. Clock and id generator are injected (`nowIso`, `nextId`) — domain logic does not call `Date.now()`, `Math.random()`, or `crypto.randomUUID()`.

---

## External dependencies

- Platform Core: projection adapter only (`platform/coachingPlatformAdapter.js`)
- Identity / Club / Player / Venue / Finance / Notification: reference ids only

---

## Legacy localStorage status

File: `src/features/coaching/services/coachingService.js`  
Key: `pickleball-coaching-v1::{clubId}`  
Class: **COMPATIBILITY_ONLY** (see `src/features/coaching/COMPATIBILITY.md`)

UI pages still use it. Canonical domain/application/repositories do **not** import it. Retirement: **COACHING-04**.

Canonical durable persistence is **not** complete in COACHING-01.

---

## SQL Phase 28 audit disposition

Audited: `docs/v5/PHASE_28_COACHING.sql`

**Not** treated as canonical schema for COACHING-01.

Observed drift / gaps for **COACHING-02**:

1. Tables mirror prototype entities (`coaching_coaches`, `coaching_students`, …) with embedded **names** — not typed reference ids.
2. Missing aggregates: program, curriculum, lesson, enrollment lifecycle, relationship, entitlement usage, attendance correction append-only log, evaluation revision.
3. Attendance statuses omit `excused`; evaluation has no draft/submitted lifecycle.
4. Packages store `price` — Finance should own price/payment SoT.
5. `tenant_id` references `venues(id)` — may conflict with Identity tenant model.
6. RLS is **commented draft only** — not enabled.
7. Permissions (`coaching.view/manage/...`) do not match canonical action ids (`coaching.program.create`, …).
8. No `version` / optimistic concurrency columns.
9. SQL **not applied** in COACHING-01; no Staging/Production writes.

---

## What COACHING-01 does **not** implement

- Durable Supabase adapter
- SQL apply / migration / RLS enablement
- UI cutover from localStorage
- Global routes / navigation changes
- Cross-module internal edits (Player, Club, Venue, Finance, Notification)
- Production RBAC wiring into Identity SQL

---

## COACHING-02 entry conditions

1. COACHING-01 PR reviewed/approved by Owner.
2. Agree canonical SQL redesign replacing Phase 28 prototype tables (or explicit additive migration plan).
3. Map canonical actions → Identity permission seed (include dedicated package/entitlement actions).
4. Durable adapter MUST implement `AttendanceCorrectionUnitOfWork` as a real DB transaction (attendance update + correction append commit/rollback together).
5. Keep localStorage UI until COACHING-04 unless Owner expands scope.
6. No Staging/Production apply without separate Owner authorization.
