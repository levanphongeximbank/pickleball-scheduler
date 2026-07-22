# CORE-12 — Court Assignment Domain Model

**Schema version (planned):** `CORE12_COURT_ASSIGNMENT_SCHEMA_V1`  
**Future module:** `src/features/competition-core/court-assignment/`  
**Phase:** 1A design only (1A-R remediated)

---

## 1. Purpose

CORE-12 assigns **already-scheduled** competition matches to **eligible courts** within a single tenant / venue / competition scope, without inventing match times, generating matchups, assigning referees, or mutating venue inventory.

---

## 2. Bounded context

```text
CORE-11 Schedule Engine          CORE-12 Court Assignment         Venue & Court
(time windows — when public) →   (court slots, eligibility)  ←   Competition Availability
  [contract deferred on main]    (capability-local DTOs)         Adapter (mandatory)
                                         │
                                         ▼
                              Immutable CourtAssignmentResult
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
              CORE-13 Referee     CORE-14 Resource        Director / Publish UI
              (consumes court)    Conflict Resolver       (display / lock UX)
                                  (deferred / optional;
                                   broader cross-resource)
```

**Naming:** CORE-11 = Schedule Engine; CORE-12 = Court Assignment; CORE-14 = Resource Conflict Resolver. Match Lifecycle is **not** CORE-14.

---

## 3. Core entities

### 3.1 CourtAssignmentRequest

Top-level immutable input for one assignment run.

| Concept | Meaning |
|---------|---------|
| Scope | `tenantId`, `clubId`, `venueId`, `competitionId` (all explicit; no ambient fallback) |
| Scheduled matches | Timed matches needing court slots |
| Available courts | Immutable availability snapshot DTOs for this run (`AvailableCourtInput[]`) — not owned inventory |
| Locked assignments | Manual / protected court binds that must be preserved |
| Constraints | Hard/soft court constraints (capability, session, exclusion) |
| Policy | Partial assign, override locks, ordering, determinism |
| Seed | Explicit deterministic seed when policy requires PRNG |
| Snapshot refs | Fingerprinted upstream schedule + availability snapshots |

### 3.2 ScheduledMatchInput

A match that already has a resolvable time window.

**Ownership status:** `ScheduledMatchInput` is a **CORE-12 capability-local normalized DTO**. It is **not** declared to be the final **CORE-11 Schedule Engine** public output contract. Current `origin/main` does not contain that final CORE-11 contract. A future anti-corruption adapter or contract-alignment layer may be required. Phase 1B must not hard-code unsupported CORE-11 assumptions; direct CORE-11 wiring is deferred until the upstream contract is available on main.

| Field concept | Notes |
|---------------|-------|
| `matchId` | Stable unique id within request |
| `competitionId` | Must match request scope |
| `scheduledStart` / `scheduledEnd` | Absolute ISO-8601 with offset or Z (normalized absolute intervals) |
| `civilWindow` | Optional `{ date, startTime, endTime }` for venue availability projection (venue-local) |
| `durationMinutes` | Derived or explicit; must be consistent with window |
| `timezone` | IANA; must agree with request/venue policy |
| `status` | Skip terminal statuses per policy (e.g. completed/forfeit) |
| `priority` / `stage` | Ordering hints only (stable tie-break still by id) |
| `requiredCapabilities` | Optional court-type / feature requirements |
| `existingCourtId` | Current bind if any |
| `manualCourtLock` | When true, assignment is locked |

**Non-ownership:** participant rest, draw dependencies, scores, schedule packing — may appear as opaque metadata only.

### 3.3 AvailableCourtInput

Immutable **availability snapshot DTO** for this assignment run — **not** live inventory and not an owned Venue & Court entity.

Must be projected from the canonical **Competition Availability Adapter** (`getCompetitionCourtAvailability` or approved successor) via consumer-side `CourtAvailabilityPort`. CORE-12 does not own inventory, operating hours, maintenance, bookings, or availability calculation.

| Field concept | Notes |
|---------------|-------|
| `courtId` | Stable unique id within request |
| `venueId` / `clubId` | Must match request scope |
| `active` | Master active flag as reported in snapshot |
| `availabilityStatus` | `AVAILABLE` \| `UNAVAILABLE` \| `LOCKED` \| `MAINTENANCE` \| `DISABLED` |
| `unavailableReasons` | Structured reason codes from the Competition Availability Adapter |
| `capabilities` | e.g. `courtType`, session tags (snapshot fields only) |
| `priority` | Soft preference only |
| `availabilityWindows` | Optional civil windows already evaluated by the adapter |

Courts marked unavailable/disabled must never receive new assignments.  
**Forbidden:** TE/CE/UI/first-venue/first-club/manual reconstructed court inventory as substitutes for the adapter snapshot.

### 3.4 CourtConstraint

Declarative constraint applied during eligibility / conflict checks.

| Kind | Examples |
|------|----------|
| HARD | No overlap; scope match; court available; window compatible; capability match; no duplicate ids |
| SOFT | Prefer higher priority court; prefer lower court load; stage→priority preference |

Constraints may be supplied by CORE-01 evaluated rule snapshots via port, or by CORE-12 built-in structural rules.

### 3.5 LockedCourtAssignment

Protected bind that CORE-12 must not silently replace.

| Field concept | Notes |
|---------------|-------|
| `matchId` | Target match |
| `courtId` | Locked court |
| `lockSource` | `MANUAL` \| `DIRECTOR` \| `IMPORT` \| `POLICY` |
| `reason` | Human-readable |
| `overrideAllowed` | Whether policy may unlock with explicit flag |

If a locked assignment is infeasible (court unavailable, overlap), result must surface a **structured conflict**, not silently move the match.

### 3.6 CourtAssignmentPolicy

| Policy knob | Default (proposed) | Meaning |
|-------------|--------------------|---------|
| `partialAssignmentAllowed` | `false` | If false, any unassigned required match → non-success |
| `overrideManualLocks` | `false` | Must be explicit true to replace locks |
| `allowUnscheduledMatches` | `false` | Reject matches missing valid windows |
| `skipTerminalStatuses` | `true` | Ignore completed/forfeit for new assigns |
| `orderingStrategy` | `STABLE_PRIORITY_THEN_ID` | Deterministic match order |
| `courtOrderingStrategy` | `STABLE_PRIORITY_THEN_ID` | Deterministic court scan order |
| `requireVenueTimezone` | `true` | Fail closed without IANA timezone |
| `requireAvailabilitySnapshot` | `true` | Fail closed without availability fingerprint when port enabled |
| `seedRequired` | policy-dependent | Fail closed if PRNG used without seed |

### 3.7 AssignedCourtSlot

Successful bind of one match to one court for one interval.

| Field concept | Notes |
|---------------|-------|
| `matchId` | |
| `courtId` | |
| `venueId` | Echo scope |
| `scheduledStart` / `scheduledEnd` | Echo match window (not reinvented) |
| `assignmentSource` | `AUTO` \| `LOCKED` \| `PRESERVED` |
| `reasonCode` / `reason` | Stable machine + human explanation |
| `importance` | Optional ordering score used |

### 3.8 UnassignedMatch

Match that could not be assigned under policy.

| Field concept | Notes |
|---------------|-------|
| `matchId` | |
| `reasonCode` | Canonical conflict / failure code |
| `message` | Diagnostic |
| `attemptedCourtIds` | Optional ordered scan list |
| `blockingConflictIds` | Links into conflict list |

### 3.9 CourtAssignmentConflict

Structured conflict / violation.

See `04_INVARIANTS_AND_CONFLICT_MODEL.md` for code catalog.

### 3.10 CourtAssignmentDiagnostics

Non-rankable run diagnostics:

- counts (input matches, assignable, assigned, locked preserved, unassigned)
- courts considered / skipped by reason
- deterministic ordering versions
- fingerprint versions
- optional wall-clock duration (**never** in result fingerprint)

### 3.11 CourtAssignmentResult

Immutable output:

| Field concept | Notes |
|---------------|-------|
| `status` | `SUCCESS` \| `PARTIAL` \| `INFEASIBLE` \| `REJECTED` \| `ERROR` |
| `requestId` | Echo |
| `assignments` | `AssignedCourtSlot[]` (stable order) |
| `unassigned` | `UnassignedMatch[]` |
| `conflicts` | `CourtAssignmentConflict[]` |
| `diagnostics` | |
| `replayMetadata` | When run is replay-certified |
| `resultFingerprint` | Stable fingerprint of assignable material |

`PARTIAL` is allowed **only** when `partialAssignmentAllowed === true`.

---

## 4. Aggregate rules

1. One match → at most one court assignment in a result.
2. One court → many non-overlapping assignments.
3. Locked assignments appear in `assignments` with `assignmentSource = LOCKED|PRESERVED` or in `conflicts` if infeasible — never dropped silently.
4. BYE / non-court-consuming matches (if present) must not receive courts (align with scheduling `INVALID_BYE_ASSIGNMENT` precedent).
5. Input collections are treated as read-only; engines clone then freeze owned outputs.

---

## 5. Identity and scoping

| Id | Owner of meaning | CORE-12 duty |
|----|------------------|--------------|
| `tenantId` | Identity / multi-tenant | Reject cross-tenant courts/matches |
| `clubId` | Club registry | Required for venue availability scope |
| `venueId` | Venue & Court | Reject cross-venue courts |
| `competitionId` | Competition / tournament | Scope all matches |
| `matchId` | CORE-09 / schedule / match runtime | Unique within request |
| `courtId` | Venue inventory | Unique within request; must belong to venue/club |

**Forbidden:** ambient “active club” from UI context; first venue in list; first unlocked court as hidden default when no eligible court exists; Tournament Engine / Court Engine / manually reconstructed inventory as availability sources.

---

## 6. Time model

### 6.1 Canonical absolute time

Assignment overlap checks use absolute instants derived from ISO-8601 `scheduledStart` / `scheduledEnd`. CORE-12 consumes **normalized absolute intervals** and does not own upstream operating-window policy.

### 6.2 Civil window for availability projection

Venue availability evaluation (inside the Competition Availability Adapter) currently uses venue-local civil `{ date, startTime, endTime }`. The **current canonical Venue & Court availability capability does not support overnight operating windows**.

CORE-12 must **fail closed** when an input interval cannot be represented unambiguously for eligibility checks. It must **not** declare overnight windows universally “invalid forever” as domain law — if upstream overnight support is added later, it must be accepted **through the canonical adapter** without recreating availability logic in CORE-12.

### 6.3 Timezone

- Request must declare IANA `timezone` when `requireVenueTimezone` is true.
- Civil windows are interpreted in that timezone when projected for adapter queries.
- Engines must not call host-local `Date` APIs for ranking / fingerprints.
- Conversion helpers belong to shared civil-time utilities; CORE-12 must pass timezone explicitly.

---

## 7. Relationship to historical scheduling types

| Historical (`scheduling/`) | CORE-12 |
|----------------------------|---------|
| `SchedulingAssignment.courtId` | Maps to `AssignedCourtSlot.courtId` |
| `SchedulingConflict` `COURT_TIME_CONFLICT` | Maps to CORE-12 conflict codes |
| `SchedulingRequest.courts` | Maps to `AvailableCourtInput[]` |
| Full `calculateCanonicalSchedule` | Remains schedule envelope — **not** CORE-12 engine |

Compatibility mappers may live under `court-assignment/adapters/` later; they must not invert ownership.

---

## 8. Non-entities (explicit)

CORE-12 domain does **not** include:

- LogicalMatch / MatchPlan generation (CORE-09)
- Schedule packing / time invention (**CORE-11 Schedule Engine** — deferred public contract)
- Referee roster entries (CORE-13)
- Generic Resource Conflict Resolver (**CORE-14** — deferred/optional; CORE-12 only owns in-request court overlap prevention)
- Score / Match Lifecycle status machines (match runtime / product — **not** CORE-14)
- Court inventory, operating hours, maintenance/booking state, availability calculation (Venue & Court)
- Optimizer `CandidateSolution` ranking substrate (**CORE-10** — optional future port only; not Phase 1B runtime)

---

## 9. Proposed module layout (Phase 1B+, not created now)

```text
competition-core/court-assignment/
  contracts/          # Request/Result factories
  enums/              # status, conflict codes, policy enums
  services/           # pure assignCourtsDeterministic
  ports/              # CourtAvailabilityPort, RulePort, AuditPort
  adapters/           # legacy TE / CE mappers (read-only parity)
  deterministic/      # ordering + optional PRNG
  errors/
  index.js            # capability-local public surface
```
