# CORE-03 Phase 1D — Capacity & Waitlist Runtime

**Wave:** 1 / CORE-03
**Phase:** 1D — Capacity & Waitlist Runtime
**Module:** `src/features/competition-core/registration-eligibility/`
**Branch intent:** `feature/competition-core-03-capacity-waitlist`
**Service version:** `CAPACITY_WAITLIST_SERVICE_VERSION` = `core03-capacity-waitlist-1.0.0`

---

## 1. Responsibilities

Phase 1D owns the **canonical capacity & waitlist runtime** (in-memory / port-based):

| Responsibility | Operation |
|----------------|-----------|
| Evaluate competition / division / combined capacity | `evaluateRegistrationCapacity` |
| Reserve capacity for a registration | `reserveRegistrationCapacity` |
| Release a capacity reservation | `releaseRegistrationCapacity` |
| Place a registration on the waitlist | `placeRegistrationOnWaitlist` |
| Withdraw a waitlisted registration | `withdrawWaitlistedRegistration` |
| Read deterministic waitlist position | `getRegistrationWaitlistPosition` |
| List ordered waitlist | `listWaitlist` |
| Select promotion candidates | `selectWaitlistPromotionCandidates` |
| Promote waitlisted registration (validated) | `promoteWaitlistedRegistration` |

Does **not** own: SQL / Supabase, UI, Core-02 Entry creation, Core-01/04/05 runtime, legacy Phase 3C, deployment.

Canonical factory:

```js
import { createCapacityWaitlistService } from "../registration-eligibility/index.js";

const service = createCapacityWaitlistService({
  repository,
  audit,
  clock,
  ids,
  capacityState,
  capacityReservations,
  waitlist,
  eligibilityEvidence,
});
```

---

## 2. Capacity scopes

Supported scopes:

1. **COMPETITION** — counters keyed by `competitionId` with `divisionId = null`
2. **DIVISION** — counters keyed by `competitionId` + `divisionId`
3. **COMBINED** — division-scoped registrations must satisfy **both** remaining competition and remaining division capacity

Rules:

- Division availability never overrides exhausted competition capacity.
- Competition availability never overrides exhausted division capacity.
- `effectiveRemaining = min(competitionRemaining, divisionRemaining)` when both apply; `null` means unlimited.

---

## 3. Capacity accounting

Per scope counters:

| Field | Meaning |
|-------|---------|
| `limit` | Configured max slots (`null` = unlimited) |
| `used` | Committed / occupied slots |
| `reserved` | Active reservation holds |
| `stateVersion` | Optimistic concurrency version |

Derived:

- `remaining = limit - used - reserved` (or `null` if unlimited)
- Snapshot fields mirror competition + division + `effectiveRemaining`

Invalid / fail-closed:

- negative limits or usage
- `used + reserved > limit`
- mismatched competition / division identity on mutate
- stale `expectedStateVersion` when provided

---

## 4. Capacity snapshot

Extends Phase 1A `RegistrationCapacitySnapshot` additively:

- `snapshotId`, `competitionUsed` / `Reserved` / `Remaining`
- `divisionUsed` / `Reserved` / `Remaining`
- `effectiveRemaining`, `calculatedAt`, `sourceVersion`, `stateVersion`

`competitionRegisteredCount` / `divisionRegisteredCount` remain aliases of used counts for compatibility.

---

## 5. Reservation behavior

Requires:

- existing registration
- matching competition / division IDs
- valid eligibility evidence (`ELIGIBLE` or `CONDITIONAL`) via `EligibilityEvidenceLookupPort`
- available `effectiveRemaining`
- no active reservation for the registration

Effects:

- increments competition (and division when scoped) `reserved` by 1
- persists `CapacityReservation` (`ACTIVE`)
- appends audit event
- uses `ClockPort` / `IdGeneratorPort`

Replay of the same `CAPACITY_RESERVE::{requestId}` returns the prior result with `replayed: true` and does not consume a second slot.

---

## 6. Release behavior

Requires an existing reservation (by id or active-by-registration).

- fail-closed on registration / competition / division mismatch
- decrements reserved counters consistently (never below 0)
- marks reservation `RELEASED` with reason + actor
- idempotent: exact request replay does not restore capacity twice or duplicate audit
- already-released reservation is a no-op path (no second counter decrement)

---

## 7. Waitlist placement

Allowed only when:

- registration exists
- Phase 1A transition to `WAITLISTED` is valid (typically `UNDER_REVIEW → WAITLISTED`)
- **one** of the following placement bases is verified:
  1. effective capacity is exhausted (`CAPACITY_EXHAUSTED`)
  2. resolved competition policy has `requireWaitlist: true` (or `waitlistRequired: true`) — `allowWaitlist` alone is **not** sufficient
  3. scope-bound `waitlistAuthorization` with `purpose = WAITLIST_PLACEMENT` matching registration/competition/division
- no active capacity reservation
- not already on the same waitlist
- eligibility evidence present unless `requireEligibility: false`

**Rejected:** bare `forceWaitlist: true` (or any boolean force flag). Callers must use exhausted capacity, policy `requireWaitlist`, or structured authorization.

Status mutation always goes through `applyRegistrationTransition` — never direct status assignment.

---

## 8. Deterministic waitlist ordering

Ascending tuple:

1. `priorityRank`
2. `submittedAt`
3. `waitlistedAt`
4. `registrationId` (lexicographic)

Priority tiers are normalized via `normalizePriorityRank` (truncate finite numbers; invalid → `0`).

No random ordering; no reliance on Map insertion or async completion order.

---

## 9. Waitlist positions

`RegistrationWaitlistPosition` (extended):

- one-based `position`
- `aheadCount`, `totalCount`
- `priorityRank`, `submittedAt`, `waitlistedAt`, `calculatedAt`, `waitlistVersion`

Two evaluations of the same waitlist state produce the same order and positions.

---

## 10. Promotion candidate selection

`selectWaitlistPromotionCandidates`:

- uses a stable capacity snapshot
- selects at most `effectiveRemaining` candidates
- respects waitlist order
- skips stale / invalid eligibility
- skips registrations that already hold capacity
- returns deterministic candidate order + `capacityStateVersion`
- **does not** approve, reserve, or create Entry

---

## 11. Promotion mutation

`promoteWaitlistedRegistration` requires:

- current status `WAITLISTED`
- active waitlist entry
- available capacity
- non-stale capacity / waitlist versions when provided
- valid eligibility evidence
- **scope-bound** `approvalAuthorization` with:
  - `purpose = WAITLIST_PROMOTION`
  - `registrationId` matching the target
  - `competitionId` matching the target
  - `divisionId` matching the target scope (null when competition-only)
  - `authorizedBy` (non-empty)
  - `authorizationRef` (non-empty)
  - `reason` (non-empty)
  - optional `issuedAt` / `authorizationVersion`
  - bare `{ approved: true }` or boolean `true` is **rejected**
  - authorizations for another registration / competition / division / purpose fail closed

On success:

1. reserve capacity
2. `WAITLISTED → APPROVED` via Phase 1A transition policy
3. mark waitlist entry `PROMOTED`
4. audit with `entryCreated: false` / `core02Entry: null`

**Never creates a Core-02 Entry.**

Authorization is structural within Core-03 boundaries (presence + scope binding of authorization fields), not an external authz system. Production authz adapters remain deferred.

---

## 12. Idempotency namespaces

| Namespace | Key form |
|-----------|----------|
| Reserve | `CAPACITY_RESERVE::{requestId}` |
| Release | `CAPACITY_RELEASE::{requestId}` |
| Place | `WAITLIST_PLACE::{requestId}` |
| Withdraw | `WAITLIST_WITHDRAW::{requestId}` |
| Promote | `WAITLIST_PROMOTE::{requestId}` |

Canonical fingerprints include material immutable fields only (no actor/correlation timestamps). Same request id + different fingerprint → `IDEMPOTENCY_CONFLICT`.

Separate from `REG_IDEMP` and `EVAL_IDEMP`.

---

## 13. Optimistic versioning

- Capacity: `stateVersion` on competition/division counters; mutate with `expectedStateVersion`
- Waitlist: scope `waitlistVersion` bumped on save; optional `expectedWaitlistVersion`

Stale versions fail closed (`STALE_CAPACITY_VERSION` / `STALE_WAITLIST_VERSION`).

---

## 14. Audit and partial-success

State-changing ops append `RegistrationAuditEvent` with:

- operation, registrationId, competitionId, divisionId
- previous/next status when applicable
- capacity snapshot id, reservation id, waitlist entry id
- positions, actor, reason, request/correlation id
- `serviceVersion`, `stateVersion` in payload

Audit failures are **not hidden**: result `ok: false`, code `AUDIT_APPEND_FAILED`, with structured partial-success metadata.

No transactional multi-port guarantee in Phase 1D (in-memory / port-based).

### Partial-success metadata flags

When a later write/audit fails after an earlier persist:

| Flag | Meaning |
|------|---------|
| `registrationTransitionPersisted` | Registration status already saved |
| `capacityCountersPersisted` | Capacity used/reserved counters already updated |
| `capacityReservationPersisted` | Reservation record already saved |
| `waitlistEntryPersisted` | Waitlist entry already saved |
| `auditPersisted` | Audit event already appended |
| `idempotencyRecordPersisted` | Idempotency replay record already saved |
| `persistedWithoutAudit` | Domain state saved but audit append failed |
| `reconciliationRequired` | Operator/runtime must reconcile incomplete multi-step write |

Exact idempotent replay after a partial failure must **not** consume a second capacity slot or create a duplicate waitlist entry. When the idempotency record was not saved (e.g. audit failed first), a same-requestId retry fails closed on the already-persisted reservation/waitlist uniqueness guard rather than double-applying counters.

---

## 15. Ownership boundaries

| In scope | Out of scope |
|----------|--------------|
| Core-03 capacity/waitlist ports + service | Core-01 rule runtime |
| Phase 1A transitions | Core-02 Entry creation |
| Eligibility evidence lookup port | Core-04/05 runtimes |
| In-memory adapters | SQL / Supabase / RLS |
| Capability barrel exports | Protected root barrel |
| | UI / deploy / lockfiles |

Legacy classification capacity validators and Phase 3C registration engines are **not** modified.

---

## 16. Deferred work

- Production SQL adapters for capacity / waitlist / reservations
- Supabase schema + RLS
- UI waitlist / capacity panels
- External authorization provider validation beyond structured scope-bound refs
- Automatic promotion workers
- Core-02 Entry creation after APPROVED
- Integrator root barrel re-export
- **Integrator-owned** registration of Phase 1D tests in `scripts/ci/unit-test-files.json` (not a Core-03 source-code blocker; capability workstreams must not edit that protected manifest)

---

## 17. Public surface

Exported from `src/features/competition-core/registration-eligibility/index.js`:

- `createCapacityWaitlistService`
- capacity/waitlist contracts + ports + policies
- `createCapacityWaitlistTestHarness`
- error codes for capacity/waitlist failures

Do **not** export mutable in-memory maps.

---

## 18. Verification

```bash
node --test tests/competition-core-registration-eligibility-core03-phase1d.test.js
node --test tests/competition-core-registration-eligibility-core03-phase1c.test.js
node --test tests/competition-core-registration-eligibility-core03-phase1b.test.js
node --test tests/competition-core-registration-eligibility-core03-phase1a.test.js
npm run lint:no-new
npm run ci:competition-architecture-lock
npm run ci:ownership-lock
```
