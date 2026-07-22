# CORE-11 Phase 1D — Dependency Graph & Deterministic Ordering

**Status:** Implemented (review)
**Capability:** CORE-11 Schedule Engine
**Date:** 2026-07-22
**Branch:** `feature/competition-core-11-schedule-engine`

---

## Canonical dependency model

Phase 1D operates on CORE-11 `ScheduleMatchInput.dependencies[]` only.

Each edge requires:

| Field | Rule |
|-------|------|
| `sourceMatchId` | Non-empty; must reference a `matchId` in the same match set |
| `type` | Required; one of the supported canonical types |

Supported types (`SCHEDULE_DEPENDENCY_TYPE`):

- `WINNER_OF`
- `LOSER_OF`
- `PREVIOUS_ROUND`
- `GROUP_STAGE_COMPLETE`
- `QUALIFICATION`

Unsupported or blank types fail closed. External / unverifiable stage barriers are not silently accepted in Phase 1D.

Legacy placeholder identities (`__PENDING_WINNER__`, `TBD`, …) are **not** canonical graph nodes.

Edge direction: **source → dependent** (predecessor completes before successor may schedule).

---

## Graph shape

`buildScheduleDependencyGraph(matches)` returns:

| Field | Meaning |
|-------|---------|
| `ok` | No ERROR diagnostics |
| `nodeIds` | ASCII-sorted match IDs |
| `nodes[]` | `matchId`, `isBye`, `isSchedulable`, ordering fields, `inDegree`, sorted `predecessors` / `successors` |
| `edges[]` | Canonical `{ sourceMatchId, dependentMatchId, type }` sorted |
| `diagnostics` | Deterministically sorted |

`inDegree` counts **unique** predecessor match IDs (multiple typed edges from the same source count once for topo readiness).

---

## Unknown / self / duplicate handling

| Failure | Code |
|---------|------|
| Unknown `sourceMatchId` | `UNKNOWN_MATCH_DEPENDENCY` |
| `sourceMatchId === matchId` | `SELF_MATCH_DEPENDENCY` |
| Duplicate `(sourceMatchId, type)` on one match | `DUPLICATE_MATCH_DEPENDENCY` |
| Duplicate `matchId` | `DUPLICATE_MATCH_ID` |

Input arrays are never mutated. Output does not depend on input order.

---

## Cycle detection

Algorithm: **recursive** DFS color marking (white / gray / black) over successor adjacency.

| Property | Detail |
|----------|--------|
| Traversal | Recursive DFS |
| Complexity | O(V + E) time; O(V) recursion depth / stack |
| Node order | ASCII `matchId` |
| Edge order | `(dependentMatchId, type)` |
| Cycle path | Rotated to lexicographically least start before diagnostics |
| Code | `CYCLIC_MATCH_DEPENDENCY` with `details.cycle` |

Practical Phase 1 fixture graphs are small (tens to low hundreds of matches). Deep recursion call-stack exhaustion is not expected for those sizes. Large-graph stress certification is deferred to the integration phase; no algorithm redesign in Phase 1D.

A cycle makes `graph.ok === false`. No valid full topological order is returned.

---

## Deterministic topological ordering

`topologicallyOrderScheduleMatches(graph)` uses Kahn’s algorithm.

Ready-set tie-breakers (complete):

1. `roundNumber` ascending (missing → `+∞`)
2. `sequence` ascending (missing → `+∞`)
3. `priority` **descending** (higher earlier; missing → `−∞`)
4. `matchId` ASCII ascending

Never uses `localeCompare`.

| Output | Contents |
|--------|----------|
| `order` | Schedulable matches only (`isBye !== true`), each once |
| `fullOrder` | Includes bye nodes for traceability |

Cyclic / invalid graphs return `ok: false` and empty `order`.

Disconnected acyclic components are ordered together under the same global tie-breakers.

---

## Bye behavior

Approved policy continues:

- bye does not consume a slot or capacity;
- bye is neither scheduled nor unscheduled;
- informational `BYE_NO_SCHEDULE_REQUIRED`.

Graph:

- bye remains a node (`isSchedulable: false`);
- structural predecessor edges from byes are allowed;
- readiness treats omitted bye predecessor state as `BYE`;
- earliest-start **never fabricates** a bye end time — bye-only dependency sets yield `DEPENDENCY_TIMING_UNAVAILABLE`.

---

## Readiness semantics (planning vs participant resolution)

CORE-11 separates three readiness concepts. There is **no** ambiguous generic `ready` boolean for Phase 1E consumers.

### 1. Schedule-planning readiness

`evaluateSchedulePlanningReadiness(matchId, graph, predecessorState)` → `planningReady`

A dependent match may be **planned** before sources complete. Planning requires a valid acyclic graph and structurally valid dependency records. Winner/loser identity is **not** required for time placement.

| Predecessor state | Planning |
|-------------------|----------|
| `SCHEDULED` | satisfies |
| `COMPLETED` | satisfies |
| `BYE` | satisfies |
| `UNRESOLVED` | blocks |
| `INVALID` | blocks |

### 2. Participant-resolution readiness

`evaluateParticipantResolutionReadiness(...)` → `participantResolutionReady`

`WINNER_OF` / `LOSER_OF` participant identity is resolved only when the source is `COMPLETED` or structurally `BYE`. A `SCHEDULED` incomplete source is **not** participant-resolution-ready. CORE-11 never infers winners, losers, or scores.

| Predecessor state | Participant resolution |
|-------------------|------------------------|
| `COMPLETED` | satisfies |
| `BYE` | satisfies |
| `SCHEDULED` | blocks (`SCHEDULED_NOT_COMPLETED`) |
| `UNRESOLVED` | blocks |
| `INVALID` | blocks |

### 3. Timing readiness

`deriveDependencyEarliestStartAbsolute(...)` → `timingReady` / `ok`

Uses known planned or completed predecessor **end** times (civil via Phase 1C or `utcMs`). A `SCHEDULED` predecessor with a known planned end **may** contribute. Bye ends are never fabricated.

`evaluateMatchDependencyReadiness` remains only as a thin combined surface exposing `planningReady` + `participantResolutionReady` (no generic `ready`).

Blockers are sorted by `(sourceMatchId, type, state, reason)`.

---

## Earliest-start lower bound

`deriveDependencyEarliestStartAbsolute({ matchId, graph, predecessorSchedule, bufferMinutes, timezone })`

Rules:

1. Requires known end timing for every **non-bye** predecessor.
2. End may be civil `{ date, minutesFromMidnight }` (converted via Phase 1C `convertCivilScheduleTimeToAbsolute`) or absolute `{ utcMs[, utcIso] }`.
3. A `SCHEDULED` or `COMPLETED` predecessor may contribute when a planned/actual end is supplied — state is not re-checked here; timing availability is the contract.
4. Lower bound = latest predecessor `utcMs` + `bufferMinutes * 60_000`.
5. `bufferMinutes` required non-negative integer (`0` allowed).
6. Does **not** select operating windows, round to slots, or assign sessions.
7. Missing timing / bye-only predecessors → `DEPENDENCY_TIMING_UNAVAILABLE` (`timingReady: false`).

This is a lower-bound calculator, not a scheduler.

---

## Diagnostics

### Reused

`INVALID_SCHEDULE_REQUEST`, `INVALID_IDENTIFIER`, `DUPLICATE_MATCH_ID`, `UNKNOWN_MATCH_DEPENDENCY`, `CYCLIC_MATCH_DEPENDENCY`, `DEPENDENCY_ORDER_VIOLATION`, `BYE_NO_SCHEDULE_REQUIRED`, `BUFFER_DURATION_INVALID`, `INVALID_TIMEZONE`

### Added (Phase 1D)

| Code | Use |
|------|-----|
| `SELF_MATCH_DEPENDENCY` | Self edge |
| `DUPLICATE_MATCH_DEPENDENCY` | Duplicate typed edge |
| `DEPENDENCY_NOT_READY` | Readiness blockers / invalid state |
| `DEPENDENCY_TIMING_UNAVAILABLE` | Missing / bye-only timing for earliest bound |

Ordering remains Phase 1B `sortScheduleDiagnostics`.

---

## Implemented files

| Path | Action | Responsibility |
|------|--------|----------------|
| `scheduleDependencyGraph.js` | create | Graph build, cycles, topo order |
| `scheduleDependencyReadiness.js` | create | Readiness + earliest bound |
| `scheduleConstants.js` | modify | Dependency types + predecessor states |
| `scheduleDiagnostics.js` | modify | Phase 1D codes |
| `scheduleTypes.js` | modify | Dependency JSDoc note |
| `index.js` | modify | Public exports |
| `tests/...phase1d-dependency-graph.test.js` | create | Focused Phase 1D tests |
| `docs/.../04_PHASE_1D_DEPENDENCY_GRAPH.md` | create | This document |

Unauthorized trees (CORE-09, CC-09, `civilTime.js`, UI, persistence) were **not** modified or imported.

---

## Test coverage

`tests/competition-core-schedule-engine-core11-phase1d-dependency-graph.test.js`

Covers empty/independent/linear/branching graphs, all five dependency types, unknown/self/duplicate failures, multi-length and disconnected cycles, topo stability and tie-breaks, readiness states including bye, earliest bound with buffer and Phase 1C conversion, immutability, and import hygiene.

Also keep Phase 1B / 1C green:

```powershell
node --test tests/competition-core-schedule-engine-core11-phase1b-contracts.test.js
node --test tests/competition-core-schedule-engine-core11-phase1c-time-windows.test.js
node --test tests/competition-core-schedule-engine-core11-phase1d-dependency-graph.test.js
```

---

## Deferred scheduler work

- Time-slot generation / session-slot allocation / match placement
- Participant/team overlap and hard rest enforcement
- Abstract capacity placement
- CORE-09 MatchPlan adapter
- CORE-10 optimizer runtime
- CORE-12 court handoff / physical assignment
- Persistence, UI, runtime cutover

---

## Next proposed phase

**Phase 1E (proposed):** baseline civil-window slot generation and dependency-aware match placement under hard rest and abstract capacity — still without physical court/referee assignment or UI cutover.
