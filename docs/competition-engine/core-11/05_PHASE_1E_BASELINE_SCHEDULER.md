# CORE-11 Phase 1E — Deterministic Slot Generation & Baseline Schedule Candidate

**Status:** Implemented (pre-commit review)
**Capability:** CORE-11 Schedule Engine
**Date:** 2026-07-22
**Branch:** `feature/competition-core-11-schedule-engine`

---

## Baseline candidate status

Phase 1E produces a **`BASELINE_SCHEDULE_CANDIDATE`**.

It is **not** a publishable / fully constraint-certified Production schedule.

| Marker | Value |
|--------|-------|
| `status` | `BASELINE_SCHEDULE_CANDIDATE` |
| `constraintCertification` | `BASELINE_ONLY` |
| Entry points | `generateAbstractScheduleSlots`, `buildBaselineScheduleCandidate`, `resolveMatchDurationMinutes`, `placeMatchIntoCandidateSlot` |

Explicitly **not** exposed: `publishSchedule`, `finalizeSchedule`, `certifiedSchedule`, `productionSchedule`.

`ok === true` means the baseline candidate placed every schedulable match under Phase 1E rules. It does **not** imply Phase 1F participant/rest certification.

---

## Time model (civil-first; no CORE-11 absolute→civil)

Canonical Time SSOT: `src/domain/civilTime.js`.

| Direction | CORE-11 path |
|-----------|--------------|
| Civil → absolute | `convertCivilScheduleTimeToAbsolute` → `civilDateTimeToUtcMs` |
| Absolute → civil | **Not implemented in CORE-11** |

`civilTime.js` does export `absoluteToCivilParts` / `absoluteToCivilMinutes`, but Phase 1E placement does **not** call them. Placement never converts UTC back to civil.

Approved placement model:

1. Abstract slots originate from normalized Phase 1C civil windows/sessions.
2. Each slot retains civil start/end.
3. UTC values are derived only via `civilDateTimeToUtcMs` (through the Phase 1C adapter).
4. Dependency earliest-start UTC lower bound comes from Phase 1D `deriveDependencyEarliestStartAbsolute`.
5. Civil earliest-start **seed** (for candidate starts) comes from planned predecessor **civil** ends + buffer (integer minutes), not from UTC→civil.
6. Feasibility filter: `slot.startUtcMs >= dependencyEarliestStartUtcMs`.
7. Capacity-release civil seeds are retained at placement time (`capacityReleaseMinutes`), not reverse-converted.

DST / IANA behavior remains entirely inherited from `civilTime.js`. No host-local getters/setters. No timezone default. Input is not mutated. No `Date.now`.

---

## Abstract slot model

Slots have **no physical court or referee identity**.

| Field | Meaning |
|-------|---------|
| `slotId` | Deterministic composite id |
| `date` / `timezone` | Civil day + explicit IANA |
| `startMinutes` / `endMinutes` | Half-open civil match interval; end = start + duration |
| `capacityReleaseMinutes` | start + duration + buffer |
| `startUtcMs` / `endUtcMs` / ISO | Absolute bounds via Phase 1C civil adapter |
| `capacityReleaseUtcMs` | Absolute capacity free time |
| `sessionId` | Present when sessions drive generation |
| `abstractSlotIndex` / `concurrencyIndex` | Abstract parallel lane (not a court) |
| `sourceWindowId` | Operating window id or session id |
| `sequence` | Canonical order after sort |

Forbidden: `courtId`, `courtName`, `courtNumber`, `assignedCourt`, `refereeId`, `assignedReferee`.

---

## Duration-resolution rules

`resolveMatchDurationMinutes(match, policy)` priority:

1. `match.estimatedDurationMinutes` when present — **invalid fails closed** (no fall-through)
2. `policy.duration.durationByStage[stageId]` when keyed
3. `policy.duration.durationByRound[String(roundNumber)]` when keyed
4. `policy.duration.defaultDurationMinutes`

**Why stage precedes round:** stage identity is the more specific competition-phase scope (e.g. finals vs group). When both maps could apply, stage wins so stage-specific timing policies are not silently overridden by round defaults.

---

## Buffer semantics

**Phase 1 policy:** slot occupancy = match duration + configured buffer.

| Concept | Formula |
|---------|---------|
| Match end | start + duration |
| Capacity release | match end + buffer |
| Next lattice start (same duration) | previous start + duration + buffer |

Match end **excludes** buffer. Abstract capacity remains occupied until capacity release.

The same `policy.duration.bufferMinutes` is used as the dependency earliest-start buffer in Phase 1E.

---

## Session behavior

| Session list | Placement windows |
|--------------|-------------------|
| Non-empty | **Only** normalized sessions; no operating-window fallback |
| Empty | Operating windows used directly |

Matches cannot cross a session (or operating) boundary. Gaps produce no slots. No silent default sessions.

---

## Multi-day behavior

Windows/sessions are sorted by civil date then start time. Placement searches chronologically across days. Overnight windows remain rejected by Phase 1C policy. Each slot keeps its source civil date.

---

## Dependency timing

Uses Phase 1D topo order and earliest-start UTC derivation.

1. Primary order = deterministic topo (roundNumber ↑, sequence ↑, priority ↓, matchId ASCII ↑).
2. Planned predecessor **civil end** + buffer seeds civil candidate starts.
3. Planned predecessor **UTC end** + buffer (Phase 1D) is the absolute lower bound.
4. Latest required non-bye predecessor end is selected.
5. Predecessor need only be **planned**, not completed.
6. **No** winner/loser identity inference.
7. Unscheduled required non-bye predecessor → `PREDECESSOR_UNSCHEDULED`.

### Bye-only dependency policy

- Structural / planning readiness may be satisfied.
- **No fabricated predecessor end.**
- Dependent earliest-start is **unconstrained** by dependency timing; window/session constraints still apply.
- Bye is neither scheduled nor unscheduled and does not consume capacity.

---

## Abstract concurrency

`policy.capacity.maxConcurrentMatches` is an abstract capacity limit.

| Rule | Behavior |
|------|----------|
| Simultaneous occupied intervals | Must not exceed max |
| Index selection | Lowest free concurrency index first |
| Occupancy interval | `[startUtcMs, capacityReleaseUtcMs)` |
| Exhaustion | `ABSTRACT_CAPACITY_EXHAUSTED` |

No venue/court repository. No CORE-12 import.

---

## Deterministic placement strategy

1. Normalize operating/session windows (Phase 1C).
2. Build + validate dependency graph (Phase 1D).
3. Obtain topo order of schedulable matches.
4. For each non-bye match: resolve duration → check predecessors → earliest-start → first-feasible abstract placement.
5. Unplaceable matches become explicit `UnscheduledMatch` records.
6. Return plan + `BASELINE_ONLY` metadata.

This is **first-feasible**, not CORE-10 objective optimization.

---

## Unscheduled-match model

| Code | Use |
|------|-----|
| `NO_FEASIBLE_TIME_SLOT` | No feasible interval under timing/window constraints |
| `PREDECESSOR_UNSCHEDULED` | Required non-bye predecessor not placed |
| `DEPENDENCY_TIMING_UNAVAILABLE` | Timing lower bound unavailable (reused) |
| `MATCH_DURATION_EXCEEDS_WINDOW` | Duration longer than every window span |
| `ABSTRACT_CAPACITY_EXHAUSTED` | Time exists but concurrency full |
| `BASELINE_CANDIDATE_INCOMPLETE` | Warning when schedulable matches remain unscheduled |
| `MATCH_DURATION_INVALID` | Duration resolution failure |

A match never appears in both scheduled and unscheduled lists. Bye matches appear in neither.

---

## BASELINE_ONLY constraint-certification

**Certified (baseline scope):** dependency order, dependency earliest-start, abstract concurrency, window/session containment.

**Deferred (Phase 1F+):** participant overlap, team overlap, minimum participant rest, minimum team rest, physical court assignment, referee assignment.

---

## Implemented files

| Path | Role |
|------|------|
| `scheduleSlotGenerator.js` | Abstract slot lattice generation |
| `baselineScheduleCandidate.js` | Duration resolve, placement, candidate builder |
| `scheduleCivilTime.js` | Civil→absolute only (no absolute→civil) |
| `scheduleConstants.js` | `CONSTRAINT_CERTIFICATION` |
| `scheduleDiagnostics.js` | Phase 1E diagnostic codes |
| `scheduleContracts.js` / `scheduleTypes.js` | Backward-compatible scheduled-match extensions |
| `index.js` | Public exports |

---

## Test coverage traceability (scenarios 1–60)

| # | Required scenario | Test name | PASS |
|---|-------------------|-----------|------|
| 1 | Empty schedule candidate | `01 empty schedule candidate` | PASS |
| 2 | Single match in one operating window | `02 single match in one operating window` | PASS |
| 3 | Multiple sequential matches | `03 multiple sequential matches` | PASS |
| 4 | Multiple abstract concurrent matches | `04 multiple abstract concurrent matches` | PASS |
| 5 | Capacity one forces sequential placement | `05 capacity one forces sequential placement` | PASS |
| 6 | Capacity greater than one permits concurrency | `06 capacity greater than one permits concurrency` | PASS |
| 7 | Lowest concurrency index preferred | `07 lowest concurrency index preferred` | PASS |
| 8 | Match-specific duration | `08 match-specific duration` | PASS |
| 9 | Default duration | `09 default duration` | PASS |
| 10 | Round-specific duration when supported | `10 round-specific duration when supported` (+ `10b` stage precedence) | PASS |
| 11 | Invalid duration | `11 invalid duration` | PASS |
| 12 | Buffer occupancy | `12 buffer occupancy` | PASS |
| 13 | Match end excludes buffer | `13 match end excludes buffer` | PASS |
| 14 | Capacity release includes buffer | `14 capacity release includes buffer` | PASS |
| 15 | Start boundary inclusive | `15 start boundary inclusive` | PASS |
| 16 | End boundary exclusive | `16 end boundary exclusive` | PASS |
| 17 | Match fits exactly at window end | `17 match fits exactly at window end` | PASS |
| 18 | Match exceeding remaining window rejected | `18 match exceeding remaining window is rejected` | PASS |
| 19 | Gap between operating windows | `19 gap between operating windows` | PASS |
| 20 | Multiple windows on one day | `20 multiple windows on one day` | PASS |
| 21 | Multiple competition days | `21 multiple competition days` | PASS |
| 22 | Session-contained placement | `22 session-contained placement` | PASS |
| 23 | Session gap unavailable | `23 session gap unavailable` | PASS |
| 24 | No fallback outside configured sessions | `24 no fallback outside configured sessions` | PASS |
| 25 | Input-order-independent windows | `25 input-order-independent windows` | PASS |
| 26 | Input-order-independent matches | `26 input-order-independent matches` | PASS |
| 27 | Deterministic repeated candidate generation | `27 deterministic repeated candidate generation` | PASS |
| 28 | Linear dependency chain | `28 linear dependency chain` | PASS |
| 29 | Branching dependencies | `29 branching dependencies` | PASS |
| 30 | Planned predecessor end controls dependent earliest start | `30 planned predecessor end controls dependent earliest start` | PASS |
| 31 | Scheduled predecessor need not be completed | `31 scheduled predecessor need not be completed` | PASS |
| 32 | Winner/loser identity is not inferred | `32 winner/loser identity is not inferred` | PASS |
| 33 | Dependency buffer applied | `33 dependency buffer applied` | PASS |
| 34 | Multiple predecessor latest end selected | `34 multiple predecessor latest end selected` | PASS |
| 35 | Bye match not placed | `35 bye match not placed` | PASS |
| 36 | Bye does not consume capacity | `36 bye does not consume capacity` | PASS |
| 37 | Bye-only dependency creates no fabricated end | `37 bye-only dependency creates no fabricated end` | PASS |
| 38 | Unscheduled predecessor blocks dependent | `38 unscheduled predecessor blocks dependent placement` | PASS |
| 39 | Unknown dependency fails closed | `39 unknown dependency fails closed` | PASS |
| 40 | Cyclic graph fails closed | `40 cyclic graph fails closed` | PASS |
| 41 | Duplicate match ID fails closed | `41 duplicate match ID fails closed` | PASS |
| 42 | Match placed at most once | `42 match placed at most once` | PASS |
| 43 | Scheduled/unscheduled mutual exclusion | `43 scheduled/unscheduled mutual exclusion` | PASS |
| 44 | No feasible slot → explicit unscheduled | `44 no feasible slot produces explicit unscheduled record` | PASS |
| 45 | Capacity exhaustion diagnostic | `45 capacity exhaustion diagnostic` | PASS |
| 46 | Deterministic unscheduled ordering | `46 deterministic unscheduled ordering` | PASS |
| 47 | BASELINE_ONLY certification marker | `47 BASELINE_ONLY certification marker` | PASS |
| 48 | No participant-overlap certification claim | `48 no participant-overlap certification claim` | PASS |
| 49 | No minimum-rest certification claim | `49 no minimum-rest certification claim` | PASS |
| 50 | No physical court fields | `50 no physical court fields` | PASS |
| 51 | No referee fields | `51 no referee fields` | PASS |
| 52 | No persistence or UI import | `52 no persistence or UI import` | PASS |
| 53 | No CORE-09 adapter import | `53 no CORE-09 adapter import` | PASS |
| 54 | No CORE-10 optimizer runtime | `54 no CORE-10 optimizer runtime` | PASS |
| 55 | No CORE-12 implementation import | `55 no CORE-12 implementation import` | PASS |
| 56 | Input immutability | `56 input immutability` | PASS |
| 57 | Existing Phase 1B tests remain green | `57 Phase 1B contracts test suite remains present` + focused Phase 1B run | PASS |
| 58 | Existing Phase 1C tests remain green | `58 Phase 1C time-windows test suite remains present` + focused Phase 1C run | PASS |
| 59 | Existing Phase 1D tests remain green | `59 Phase 1D dependency-graph test suite remains present` + focused Phase 1D run | PASS |
| 60 | No Date.now / Math.random / localeCompare | `60 no Date.now, Math.random or localeCompare in executable code` | PASS |

Additional focused tests (not required matrix IDs): `10b`, `61`, `62`.

---

## Deferred Phase 1F constraints

- Participant overlap / shared-player identity
- Team overlap
- Minimum participant rest / team rest
- Workload balancing
- Full capacity certification beyond abstract concurrency

## Next proposed phase

**Phase 1F — Participant / team / rest constraint certification** on the baseline candidate (still without physical court assignment or optimizer runtime).
