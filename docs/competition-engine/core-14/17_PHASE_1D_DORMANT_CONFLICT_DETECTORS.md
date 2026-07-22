# CORE-14 — Phase 1D Dormant Conflict Detectors

**Phase:** 1D
**Status:** Implemented (dormant / unwired)
**Date:** 2026-07-22
**Owner authorization:** `AUTHORIZE_CORE_14_PHASE_1D_DORMANT_CONFLICT_DETECTORS`
**Prior verdict:** `CORE_14_PHASE_1C_APPROVED`

---

## 1. Detector ownership

| Detector | Owns | Does not own |
|----------|------|--------------|
| Time-overlap | Specialized exclusive conflicts for PLAYER / TEAM / COURT / REFEREE; exclusive LOCATION | Venue-by-venueId collisions; equipment/custom generic overlaps; schedule generation |
| Capacity | Non-exclusive LOCATION, VENUE, EQUIPMENT, CUSTOM_RESOURCE maximal over-capacity windows | Duplicate capacity-one reporting already owned by specialized overlap |
| Rest | PLAYER / TEAM mandatory or preferred rest gaps | Courts, referees, venues, locations, equipment, custom |
| Availability | Findings from normalized facts or injected test-double port | Production Venue & Court adapters; inventory/blackout invention |
| Orchestration (`detectResourceConflicts`) | Validate → duplicate integrity → detectors → suppression → status derivation | Recommendations, mutation, persistence, UI, root export |

Module remains **capability-local** under `src/features/competition-core/resource-conflict/`.
Root `src/features/competition-core/index.js` is **not** modified.

---

## 2. Overlap algorithm

1. Group validated occupancies by `CanonicalResourceKey` serialization.
2. Sort each group by `(startMs, endMs, occupancyId)`.
3. Active sweep: drop completed intervals where `endMs <= current.startMs` (half-open).
4. Emit one finding per unordered overlapping pair with intersection evidence.
5. Complexity target: **O(n log n + k)** where `k` is emitted overlapping pairs.

Adjacent half-open intervals do **not** overlap.

Finding codes:

- PLAYER → `PLAYER_TIME_OVERLAP`
- TEAM → `TEAM_TIME_OVERLAP`
- COURT → `COURT_TIME_OVERLAP`
- REFEREE → `REFEREE_TIME_OVERLAP`
- LOCATION exclusive → `LOCATION_TIME_OVERLAP`
- LOCATION non-exclusive → no location overlap (capacity path)
- VENUE / EQUIPMENT / CUSTOM_RESOURCE → no fabricated generic overlap code

---

## 3. Capacity event scan

For each resource key eligible for capacity findings:

```text
events: +capacityUnits at startMs, -capacityUnits at endMs
sort: t asc; releases before acquires at equal t; then occupancyId
scan active units; emit maximal contiguous windows where active > capacity
```

Capacity must be a safe integer `> 0`. Missing/invalid capacity fails closed.

Specialized overlap kinds and exclusive LOCATION skip capacity findings for the same root cause.

---

## 4. Rest semantics

Policy requires:

- `restMode`: `MANDATORY` | `PREFERRED`
- `minimumRestMs`: safe integer `>= 0`
- `applicableResourceKinds`: PLAYER and/or TEAM only
- `policyVersion`

For each player/team resource, sort occupancies and compare consecutive distinct activities:

```text
restGapMs = next.startMs - previous.endMs
```

| Gap | Action |
|-----|--------|
| `< 0` | Overlap owns root cause; no rest finding |
| `< minimumRestMs` | `MANDATORY_REST_VIOLATION` (HARD) or `PREFERRED_REST_WARNING` (SOFT) |
| `>= minimumRestMs` | No finding |

---

## 5. Availability modes

### AUTHORITATIVE

| Status | Behavior |
|--------|----------|
| AVAILABLE | No finding |
| UNAVAILABLE | `RESOURCE_UNAVAILABLE` / `VENUE_UNAVAILABLE`, canonical severity **HARD** |
| UNKNOWN / missing | `AVAILABILITY_DATA_UNAVAILABLE`; `evaluationStatus=DATA_UNAVAILABLE`; `planStatus=NOT_EVALUATED`; certification `NOT_EVALUATED` |

### ADVISORY

| Status | Behavior |
|--------|----------|
| AVAILABLE | No finding |
| UNAVAILABLE | Same finding codes, canonical severity **SOFT** |
| UNKNOWN / missing | Diagnostic; not treated as available; evaluation may complete; certification `PARTIAL`; without HARD findings → `VALID_WITH_WARNINGS` |

Certification:

- `FULL` — every queried resource received a definitive AVAILABLE or UNAVAILABLE answer
- `PARTIAL` — at least one advisory unknown/provider failure
- `NOT_EVALUATED` — authoritative failure or availability not in scope

Explicit UNAVAILABLE with complete data remains `FULL` (unavailable ≠ partial).

---

## 6. Duplicate root-cause suppression

Deterministic rules (documented in `DUPLICATE_SUPPRESSION_RULES`):

1. `VENUE_CAPACITY_EXCEEDED` suppresses `RESOURCE_CAPACITY_EXCEEDED` for the same venue key.
2. `VENUE_UNAVAILABLE` suppresses `RESOURCE_UNAVAILABLE` for the same venue occupancy set.
3. Specialized overlap suppresses generic capacity for shared occupancy IDs on the same resource key.
4. Exclusive LOCATION uses overlap path (capacity findings skipped at detector level).
5. Overlap suppresses rest for the same occupancy pair (negative-gap case).

Independent conflicts (e.g., court overlap + referee overlap on the same two matches) both remain.

---

## 7. Result status derivation

| Condition | `evaluationStatus` | `planStatus` |
|-----------|--------------------|--------------|
| Invalid canonical input / blocking diagnostics | `REJECTED_INVALID_INPUT` | `NOT_EVALUATED` |
| Authoritative availability failure | `DATA_UNAVAILABLE` | `NOT_EVALUATED` |
| Completed with ≥1 HARD finding | `COMPLETED` | `INVALID_HARD_CONFLICTS` |
| Completed, no HARD, SOFT and/or advisory PARTIAL | `COMPLETED` | `VALID_WITH_WARNINGS` |
| Completed, no findings, no certification warning | `COMPLETED` | `VALID` |

`recommendationCount` remains **0** in Phase 1D.

---

## 8. Complexity

| Detector | Target |
|----------|--------|
| Overlap | O(n log n + k) |
| Capacity | O(n log n) event sort + linear scan per resource group |
| Rest | O(n log n) sort + linear consecutive scan |
| Availability | O(n + f) for n occupancies and f facts |
| Suppression | O(m) over finding count m |

---

## 9. Test evidence

Focused suite:

`tests/competition-core-resource-conflict-core14-phase1d.test.js`

Covers overlap (1–16), capacity (17–28), rest (29–39), availability (40–49), orchestration/determinism/boundaries (50–68).

Also re-run Phase 1C focused tests and Competition Core regression list used previously for CORE-14 workstreams.

---

## 10. Non-goals (Phase 1D)

- Schedule / time / court / referee selection
- Global optimization
- Resolution recommendations or recommendation validation
- Assignment mutation
- Production availability adapters
- Venue & Court implementation imports
- CORE-10 / 11 / 12 / 13 implementation imports
- UI, persistence, SQL, feature flags, root Competition Core exports
- Commit / push / PR / deploy
