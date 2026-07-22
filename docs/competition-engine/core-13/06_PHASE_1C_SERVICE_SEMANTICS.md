# CORE-13 — Phase 1C Service Semantics

**Module:** `src/features/competition-core/referee-assignment/services/`
**Schema:** `CORE13_REFEREE_ASSIGNMENT_SCHEMA_V1`

Phase 1C implements five pure deterministic operations.
Phase 1D adds `assignReferees` and `replaceRefereeAssignment` (see `07_PHASE_1D_ASSIGNMENT_PLANNER.md`).
Phase 1D also corrects fairnessDelta and affiliation-conflict policy (below).

---

## 1. Public operations

| Operation | Purpose |
|-----------|---------|
| `evaluateRefereeEligibility` | Hard/soft evaluation for one candidate × match × concrete role |
| `detectRefereeConflicts` | Referee-domain conflict facts (+ CORE-14 projections) |
| `calculateRefereeWorkload` | Quantized workload from assignments + schedule |
| `validateManualRefereeAssignment` | Validate only — no persist/apply |
| `explainUnassignedMatch` | Match-level unassigned diagnostics |

---

## 2. Half-open interval semantics

Schedule windows use **`[startAt, endAt)`**:

1. `startAt` inclusive
2. `endAt` exclusive
3. An assignment ending exactly when another begins is **not** an overlap
4. `endAt` must be strictly greater than `startAt`
5. No `Date.now` / wall-clock generation
6. `Date.parse` only interprets validated explicit instant strings
7. Invalid timestamps fail closed (`NON_DETERMINISTIC_INPUT` / `SCHEDULE_WINDOW_REQUIRED`)
8. No locale or host-timezone decisioning

---

## 3. Role `ANY` restriction

`RefereeRoleCode.ANY` is a **policy/matching wildcard only**.

It must **never** appear as the concrete `roleCode` of:

- `RefereeAssignment`
- accepted manual assignment
- replacement result
- resource conflict projection

Manual requests using `ANY` as concrete role → `REFEREE_ROLE_UNSUPPORTED`.

---

## 4. Eligibility hard constraints

Evaluated (all discoverable failures collected when structurally possible):

- tenant / tournament / match scope
- candidate exists and active
- concrete supported role (not `ANY`)
- required role qualification (+ optional certification evidence)
- qualification validity for match time
- availability covers full match window
- no overlapping existing assignment / max simultaneous
- match-specific exclusion / COI / self-referee prohibition

Soft notes (preferred tags/role) never override hard failures.

---

## 5. Conflict categories

- schedule overlap
- referee is participant (same `playerId`) — hard by default
- explicit prohibited team / club / organization lists — hard
- general team / club / organization affiliation — hard **only** when the corresponding flag is true (`disallowAffiliatedTeamReferee` / `Club` / `Organization`, default **false**); otherwise optional soft note
- explicit referee exclusion
- explicit referee–match exclusion
- duplicate concrete role on same match
- policy-forbidden self-refereeing (denied unless `allowSelfRefereed === true`)

Ordering: `matchId` → `refereeId` → `conflictType` → conflicting match → stable id.
No `localeCompare`.

CORE-13 emits referee-domain facts and `resourceType=REFEREE` projections.
**Does not import CORE-14.** CORE-14 may aggregate later.

---

## 6. Workload status handling

| Status | Current workload |
|--------|------------------|
| `PLANNED` | counts (planned + active) |
| `CONFIRMED` | counts (confirmed + active) |
| `REPLACED` | excluded from current |
| `RELEASED` | excluded from current |

`historicalAssignmentCount` is separate and never silently merged into `assignmentCount`.

### fairnessDelta (Phase 1D correction)

```text
fairnessDelta = abs(activeAssignmentCount * refereePopulationSize - totalActiveAssignmentCount)
fairnessScale = refereePopulationSize
```

Integer-scaled and symmetric around the exact population mean. Do not use a floating-point mean as the canonical fingerprint value. Computed per batch of referees in the call.

### Consecutive / court transitions

Uses explicit `consecutiveGapMinutesThreshold` (default **30**).
Court transition: consecutive timed active assignments with different `courtId` within the gap threshold.

---

## 7. Manual rejection semantics

Envelope: `MANUAL_ASSIGNMENT_REJECTED` (FATAL).

- `causedBy` = primary underlying reason
- `reasonCodes` = all applicable underlying reasons, unique, stable-sorted
- Hard failures never overridable
- Soft notes require explicit `allowSoftOverride === true`

---

## 8. Unassigned diagnostic ordering

`explainUnassignedMatch` returns `UnassignedRefereeRequirement` with:

- `reasonCodes` stable-sorted
- `reasonCounts` keyed in stable order
- `blockingConflicts` sorted by match/referee/type/id
- Valid empty directory → `NO_REFEREE_CANDIDATES`
- Populated but none eligible → `NO_ELIGIBLE_REFEREE` + underlying codes
- Individual match missing window → `SCHEDULE_WINDOW_REQUIRED`
- Does not abort a future plan — match-recoverable diagnostics only

---

## 9. Snapshot semantics

| Status | Behavior |
|--------|----------|
| `MISSING` | FATAL |
| `INVALID` | FATAL |
| `EMPTY` | Valid; may yield match-recoverable diagnostics |
| `POPULATED` | Evaluate normally |

Empty directory ≠ `SNAPSHOT_MISSING`.
Missing schedule port ≠ empty schedule.

---

## 10. Deferred

- `assignReferees` / automatic ranking / planning
- `replaceRefereeAssignment` execution
- persistence, adapters, UI, CORE-14 implementation
