# CORE-12 — Court Assignment Contracts

**Schema version (planned):** `CORE12_COURT_ASSIGNMENT_SCHEMA_V1`  
**Naming convention:** Follow CORE-09 / CORE-10 **factory patterns** (`create*`, strict allowlists, freeze, fail-closed unknown fields) — **pattern reuse only**; Phase 1B greedy assigner has **no CORE-10 runtime dependency**.  
**Phase:** 1A design only (1A-R remediated)

**Core identity (consistent naming):**

| Core | Name |
|------|------|
| CORE-11 | Schedule Engine (public contract deferred on current main) |
| CORE-12 | Court Assignment |
| CORE-14 | Resource Conflict Resolver (deferred / optional) |

Venue & Court **Competition Availability Adapter** is the mandatory availability source. Capability-local DTOs ≠ upstream public contracts.

---

## 1. Canonical names

After auditing repository conventions, the following names are canonical:

| Concept | Canonical name |
|---------|----------------|
| Request | `CourtAssignmentRequest` |
| Scheduled match input | `ScheduledMatchInput` |
| Available court input | `AvailableCourtInput` |
| Constraint | `CourtConstraint` |
| Locked assignment | `LockedCourtAssignment` |
| Policy | `CourtAssignmentPolicy` |
| Result | `CourtAssignmentResult` |
| Assigned slot | `AssignedCourtSlot` |
| Unassigned match | `UnassignedMatch` |
| Conflict | `CourtAssignmentConflict` |
| Diagnostics | `CourtAssignmentDiagnostics` |
| Primary port | `CourtAssignmentPort` |
| Availability port | `CourtAvailabilityPort` |
| Rule evaluation port | `CourtAssignmentRulePort` |
| Audit port | `CourtAssignmentAuditPort` |

**Rejected aliases (do not mix into public surface):**  
`assignCourts` context bag, `EngineContext`, `generateCourtAssignments` session proposal, `SchedulingAssignment` as CORE-12 SSOT.

Legacy adapters may wrap those shapes; public CORE-12 API must use the names above.

---

## 2. Factory and immutability rules

1. `createX(partial)` clones allowlisted fields, validates, then `Object.freeze` (deep-freeze owned trees).
2. Unknown fields → `CourtAssignmentContractError` (fail closed) on strict schemas.
3. Reject functions, `Date`, `Map`, `Set`, `undefined`, `NaN`, `Infinity` in replay-certified material.
4. Caller-owned inputs are never mutated.
5. Arrays are copied; nested objects are rebuilt from allowlists.
6. `schemaVersion` must equal `CORE12_COURT_ASSIGNMENT_SCHEMA_V1`.

---

## 3. Enumerations (planned)

### 3.1 `CourtAssignmentStatus`

`SUCCESS` | `PARTIAL` | `INFEASIBLE` | `REJECTED` | `ERROR`

### 3.2 `CourtAvailabilityStatus`

`AVAILABLE` | `UNAVAILABLE` | `LOCKED` | `MAINTENANCE` | `DISABLED`

### 3.3 `CourtConstraintKind`

`HARD` | `SOFT`

### 3.4 `CourtAssignmentSource`

`AUTO` | `LOCKED` | `PRESERVED`

### 3.5 `CourtLockSource`

`MANUAL` | `DIRECTOR` | `IMPORT` | `POLICY`

### 3.6 `CourtOrderingStrategy`

`STABLE_PRIORITY_THEN_ID` | `STABLE_ID_ONLY`

### 3.7 `MatchOrderingStrategy`

`STABLE_PRIORITY_THEN_ID` | `STABLE_ID_ONLY` | `STABLE_START_THEN_ID`

---

## 4. Contract field tables

### 4.1 `CourtAssignmentRequest`

| Field | Required | Type / notes |
|-------|----------|--------------|
| `schemaVersion` | yes | `CORE12_COURT_ASSIGNMENT_SCHEMA_V1` |
| `requestId` | yes | Opaque stable string |
| `tenantId` | yes | Non-empty |
| `clubId` | yes | Non-empty (availability / venue scope) |
| `venueId` | yes | Non-empty |
| `competitionId` | yes | Non-empty |
| `timezone` | yes when policy.requireVenueTimezone | IANA string |
| `matches` | yes | `ScheduledMatchInput[]` (may be empty → trivial success) |
| `courts` | yes | `AvailableCourtInput[]` |
| `lockedAssignments` | no | `LockedCourtAssignment[]` default `[]` |
| `constraints` | no | `CourtConstraint[]` default `[]` |
| `policy` | yes | `CourtAssignmentPolicy` |
| `seed` | conditional | Required when policy uses PRNG |
| `scheduleSnapshotRef` | recommended | `{ snapshotId, snapshotVersion, fingerprint }` |
| `availabilitySnapshotRef` | conditional | Required when policy.requireAvailabilitySnapshot |
| `metadata` | no | Canonical plain object only |

Strict: reject unknown top-level fields.

### 4.2 `ScheduledMatchInput`

**Capability-local DTO** (CORE-12-owned normalization). **Not** the final CORE-11 Schedule Engine public output contract. Alignment / anti-corruption adapter may be required when CORE-11 lands on main. Phase 1B must not hard-code unsupported CORE-11 shapes.

| Field | Required | Notes |
|-------|----------|-------|
| `matchId` | yes | Unique in request |
| `competitionId` | yes | Must equal request.competitionId |
| `scheduledStart` | yes* | ISO-8601 absolute instant; *unless policy allows unscheduled (default reject) |
| `scheduledEnd` | yes* | Must be strictly after start |
| `civilWindow` | recommended | `{ date: YYYY-MM-DD, startTime: HH:mm, endTime: HH:mm }` for adapter projection |
| `timezone` | no | If present must equal request.timezone |
| `durationMinutes` | no | If present must match window length within tolerance policy |
| `status` | no | String; terminal handling per policy |
| `priority` | no | Finite number; default 0 |
| `stage` | no | Opaque string for diagnostics |
| `requiredCapabilities` | no | String tags / `{ courtType?: ... }` |
| `existingCourtId` | no | |
| `manualCourtLock` | no | Boolean |
| `isBye` | no | If true, must not consume court |
| `metadata` | no | Plain object |

Intervals that cannot be represented unambiguously (including cases the current Venue & Court adapter cannot project — e.g. overnight civil windows unsupported today) must fail closed at validation / eligibility time. CORE-12 does not own upstream overnight operating-window policy.

### 4.3 `AvailableCourtInput`

Immutable **availability snapshot DTO** projected from the Venue & Court **Competition Availability Adapter**. CORE-12 does **not** own inventory, hours, maintenance, bookings, or availability calculation. Not a substitute for calling `getCompetitionCourtAvailability` (or approved successor).

| Field | Required | Notes |
|-------|----------|-------|
| `courtId` | yes | Unique in request |
| `venueId` | yes | Must equal request.venueId |
| `clubId` | yes | Must equal request.clubId |
| `availabilityStatus` | yes | Enum |
| `active` | yes | Boolean |
| `unavailableReasons` | no | String codes from canonical adapter |
| `capabilities` | no | Incl. `courtType` |
| `priority` | no | Finite number; default 0 |
| `availabilityWindows` | no | Civil windows as reported by adapter |
| `metadata` | no | |

### 4.4 `CourtConstraint`

| Field | Required | Notes |
|-------|----------|-------|
| `constraintId` | yes | Stable |
| `kind` | yes | `HARD` \| `SOFT` |
| `code` | yes | Machine code |
| `matchId` | no | Scope to one match |
| `courtId` | no | Scope to one court |
| `params` | no | Plain object |
| `message` | no | |

### 4.5 `LockedCourtAssignment`

| Field | Required | Notes |
|-------|----------|-------|
| `matchId` | yes | |
| `courtId` | yes | |
| `lockSource` | yes | Enum |
| `reason` | no | |
| `overrideAllowed` | no | Default false |

### 4.6 `CourtAssignmentPolicy`

| Field | Required | Default |
|-------|----------|---------|
| `policyId` | yes | |
| `policyVersion` | yes | |
| `partialAssignmentAllowed` | yes | `false` |
| `overrideManualLocks` | yes | `false` |
| `allowUnscheduledMatches` | yes | `false` |
| `skipTerminalStatuses` | yes | `true` |
| `terminalStatuses` | no | `["completed","forfeit"]` |
| `matchOrderingStrategy` | yes | `STABLE_PRIORITY_THEN_ID` |
| `courtOrderingStrategy` | yes | `STABLE_PRIORITY_THEN_ID` |
| `requireVenueTimezone` | yes | `true` |
| `requireAvailabilitySnapshot` | yes | `true` |
| `capabilityMatchMode` | yes | `IGNORE` \| `HARD` \| `SOFT` (default `HARD` when capabilities present on match; else `IGNORE`) |
| `overlapMode` | yes | `HALF_OPEN` (`start < otherEnd && otherStart < end`) |
| `comparatorVersion` | yes | Version string for ordering |

### 4.7 `AssignedCourtSlot`

| Field | Required | Notes |
|-------|----------|-------|
| `matchId` | yes | |
| `courtId` | yes | |
| `venueId` | yes | |
| `scheduledStart` | yes | Echo |
| `scheduledEnd` | yes | Echo |
| `assignmentSource` | yes | Enum |
| `reasonCode` | yes | Stable |
| `reason` | no | |
| `importance` | no | |

### 4.8 `UnassignedMatch`

| Field | Required | Notes |
|-------|----------|-------|
| `matchId` | yes | |
| `reasonCode` | yes | |
| `message` | yes | |
| `attemptedCourtIds` | no | Stable order |
| `blockingConflictIds` | no | |

### 4.9 `CourtAssignmentConflict`

| Field | Required | Notes |
|-------|----------|-------|
| `conflictId` | yes | Stable within result |
| `code` | yes | See invariants doc |
| `severity` | yes | `HARD` \| `SOFT` \| `INFO` |
| `message` | yes | |
| `matchIds` | no | |
| `courtIds` | no | |
| `details` | no | Plain object |

### 4.10 `CourtAssignmentDiagnostics`

| Field | Required | Notes |
|-------|----------|-------|
| `engineVersion` | yes | |
| `inputMatchCount` | yes | |
| `assignableMatchCount` | yes | |
| `assignedCount` | yes | |
| `lockedPreservedCount` | yes | |
| `unassignedCount` | yes | |
| `courtCount` | yes | |
| `orderingVersions` | yes | |
| `notes` | no | String[] |
| `wallClockMs` | no | Non-replay only |

### 4.11 `CourtAssignmentResult`

| Field | Required | Notes |
|-------|----------|-------|
| `schemaVersion` | yes | |
| `status` | yes | Enum |
| `requestId` | yes | Echo |
| `tenantId` / `clubId` / `venueId` / `competitionId` | yes | Echo scope |
| `assignments` | yes | Stable order by matchId |
| `unassigned` | yes | Stable order by matchId |
| `conflicts` | yes | Stable order by conflictId |
| `diagnostics` | yes | |
| `replayMetadata` | conditional | Required for certified runs |
| `resultFingerprint` | yes | |
| `failure` | conditional | `{ code, message, details? }` when REJECTED/ERROR |

---

## 5. Ports

### 5.1 `CourtAssignmentPort` (primary)

```text
assignCourts(request: CourtAssignmentRequest) → CourtAssignmentResult
validateRequest(request: CourtAssignmentRequest) → ValidationResult
```

Pure domain port. Implementations must be free of UI stores, `localStorage`, and ambient club context.

**Test doubles (Phase 1B):** `createFailClosedCourtAssignmentPort`, `createFixedCourtAssignmentPort`.

### 5.2 `CourtAvailabilityPort` (consumer-side boundary only)

```text
resolveAvailability(query) → AvailabilitySnapshot
```

**Role:** CORE-12 consumer-side port that adapts the mandatory Venue & Court **Competition Availability Adapter** (`getCompetitionCourtAvailability` or Owner-approved canonical successor) into an immutable snapshot for the assigner.

Query includes `clubId`, `venueId`, `courtIds`, civil window(s), optional `clusterId`, fingerprint expectations.

Snapshot includes per-court availability status + reasons + fingerprint, which populate `AvailableCourtInput[]`.

**Must not:**

- Own inventory, operating hours, maintenance, bookings, or availability calculation
- Write bookings or mutate inventory
- Pick “first available” / first venue / first club for the caller
- Fall back to Tournament Engine, Court Engine, UI stores, or manually reconstructed court inventory

**Adapter target:** wrap **only** `getCompetitionCourtAvailability` (or approved successor). TE/CE availability guards are legacy consumers — not CORE-12 fallback sources. Do not deep-import Venue private internals into domain services.

### 5.3 `CourtAssignmentRulePort` (read-only)

```text
resolveEvaluatedRules(request) → EvaluatedCourtAssignmentRules
```

Binds CORE-01 operation `COURT_ASSIGNMENT` evaluated snapshot (`ruleSetId`, `ruleSetVersion`, `ruleEvaluationFingerprint`, hard/soft court-related constraints).

**Must not:** implement a second rule engine inside CORE-12.

### 5.4 `CourtAssignmentAuditPort` (optional persist)

```text
append(event) → { auditEventId }
```

Mirrors lineup-style audit append. Phase 1B may ship in-memory double only.

---

## 6. Replay metadata

Required for replay-certified runs (align with CORE-09/10 **fingerprint conventions** as patterns; not a CORE-10 runtime dependency):

- `engineVersion`
- `contractSchemaVersion`
- `policyId` / `policyVersion`
- `comparatorVersion`
- `fingerprintAlgorithmVersion`
- `scheduleSnapshotFingerprint`
- `availabilitySnapshotFingerprint`
- `ruleEvaluationFingerprint` (when rules port used)
- `seed` / `prngVersion` when applicable
- `resultFingerprint`

**Excluded from fingerprint material:** wall-clock duration, machine identity, current timestamp, process id, memory, UI session ids.

---

## 7. Validation expectations

1. Duplicate `matchId` or `courtId` → `REJECTED` with conflict codes.
2. Reversed or equal time windows → `REJECTED`.
3. Cross-tenant / cross-venue / cross-club ids → `REJECTED`.
4. Missing timezone when required → `REJECTED`.
5. Locked assignment referencing unknown match/court → `REJECTED`.
6. Capability hard mismatch → court ineligible (or conflict if locked).
7. Empty courts with assignable matches → `INFEASIBLE` or `PARTIAL` per policy — never invent courts.

---

## 8. Mapping from legacy TE `assignCourts`

| Legacy | CORE-12 |
|--------|---------|
| `context.matches` | `matches: ScheduledMatchInput[]` |
| `context.courts` | `courts: AvailableCourtInput[]` |
| `match.manualCourtLock` | `LockedCourtAssignment` + `manualCourtLock` |
| `options.overrideManual` | `policy.overrideManualLocks` |
| `data.assignments` | `assignments` |
| `data.conflicts` | `conflicts` + `unassigned` |
| `ok: conflicts.length===0 \|\| assignments.length>0` | **Rejected pattern** — replace with explicit status enum |

---

## 9. Public export policy (future)

Capability-local: `court-assignment/index.js` only.  
Do **not** modify root `competition-core/index.js` until Integrator certification (same rule as CORE-09/10).
