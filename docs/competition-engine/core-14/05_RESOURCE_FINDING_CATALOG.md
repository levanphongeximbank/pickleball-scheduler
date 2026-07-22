# CORE-14 — Resource Finding Catalog

**Contract family:** `core14-resource-finding-catalog-v1`
**Phase:** 1B / 1B-S — Contract Freeze
**Status:** Frozen — single catalog for every finding code CORE-14 may emit
**Date:** 2026-07-22

---

## 1. Catalog rules

1. CORE-14 emits **only** codes listed here (plus future versioned additions under Owner approval).
2. Avoid generic and specialized **duplicate emission** for the same root cause.
3. Input validation errors are **not** findings; they are input diagnostics ([06_DIAGNOSTIC_CATALOG.md](./06_DIAGNOSTIC_CATALOG.md)).
4. Same `venueId` alone must **not** create a conflict.

### Precedence (capacity / availability)

| Situation | Emit | Do not emit |
|-----------|------|-------------|
| Venue capacity exceeded | `VENUE_CAPACITY_EXCEEDED` | `RESOURCE_CAPACITY_EXCEEDED` |
| Non-venue capacity exceeded | `RESOURCE_CAPACITY_EXCEEDED` | `VENUE_CAPACITY_EXCEEDED` |
| Venue unavailable | `VENUE_UNAVAILABLE` | `RESOURCE_UNAVAILABLE` |
| Non-venue unavailable | `RESOURCE_UNAVAILABLE` | `VENUE_UNAVAILABLE` |

---

## 2. Finding envelope (minimum)

```text
ResourceFinding {
  findingId: string                 // deterministic
  code: ResourceFindingCode
  severity: Severity                // effective severity after policy
  resourceKey: CanonicalResourceKey
  occupancyIds: string[]            // sorted ascending for identity
  assignmentIds: string[]           // derived/sorted when present
  violationStartMs: number | null
  violationEndMs: number | null
  evidence: FindingEvidence
  blocksPlanValidity: boolean
  permittedActionTypes: ResolutionActionType[]
  reasonCode: string
  policyVersion: string
}
```

---

## 3. Codes

### 3.1 PLAYER_TIME_OVERLAP

| Field | Value |
|-------|-------|
| Meaning | Same player resource has overlapping occupancies |
| Applicable `resourceKind` | `PLAYER` |
| Canonical minimum severity | `HARD` |
| Required evidence | overlapping `occupancyIds` (≥2), `violationStartMs`/`violationEndMs` |
| Blocks plan validity | Yes |
| Permitted action types | `MOVE_ASSIGNMENT_TIME`, `INSERT_REST_GAP` (if applicable after move), `MARK_FOR_MANUAL_REVIEW`, `NO_SAFE_AUTOMATIC_RESOLUTION` |
| Co-emission | May co-exist with rest findings on other pairs; must not also emit generic capacity/unavailable for the same overlap root cause |

### 3.2 TEAM_TIME_OVERLAP

| Field | Value |
|-------|-------|
| Meaning | Same team resource has overlapping occupancies |
| Applicable `resourceKind` | `TEAM` |
| Canonical minimum severity | `HARD` |
| Required evidence | overlapping `occupancyIds` (≥2), violation window |
| Blocks plan validity | Yes |
| Permitted action types | `MOVE_ASSIGNMENT_TIME`, `MARK_FOR_MANUAL_REVIEW`, `NO_SAFE_AUTOMATIC_RESOLUTION` |
| Co-emission | Same as player overlap rules |

### 3.3 COURT_TIME_OVERLAP

| Field | Value |
|-------|-------|
| Meaning | Same court resource has overlapping occupancies exceeding exclusive use (default capacity 1) |
| Applicable `resourceKind` | `COURT` |
| Canonical minimum severity | `HARD` |
| Required evidence | overlapping `occupancyIds`, violation window |
| Blocks plan validity | Yes |
| Permitted action types | `REASSIGN_COURT`, `MOVE_ASSIGNMENT_TIME`, `MARK_FOR_MANUAL_REVIEW`, `NO_SAFE_AUTOMATIC_RESOLUTION` |
| Co-emission | If modeled as capacity>1 court, prefer capacity exceedance semantics; do not emit both overlap and capacity for identical root cause — Phase 1C uses capacity scan when `capacityUnits`/`capacity` > 1, else overlap code |

### 3.4 REFEREE_TIME_OVERLAP

| Field | Value |
|-------|-------|
| Meaning | Same referee has overlapping occupancies |
| Applicable `resourceKind` | `REFEREE` |
| Canonical minimum severity | `HARD` |
| Required evidence | overlapping `occupancyIds`, violation window |
| Blocks plan validity | Yes |
| Permitted action types | `REASSIGN_REFEREE`, `MOVE_ASSIGNMENT_TIME`, `MARK_FOR_MANUAL_REVIEW`, `NO_SAFE_AUTOMATIC_RESOLUTION` |
| Co-emission | No duplicate generic unavailable for same overlap |

### 3.5 RESOURCE_CAPACITY_EXCEEDED

| Field | Value |
|-------|-------|
| Meaning | Concurrent `capacityUnits` on a non-venue resource exceed capacity |
| Applicable `resourceKind` | `PLAYER`, `TEAM`, `COURT`, `REFEREE`, `LOCATION`, `EQUIPMENT`, `CUSTOM_RESOURCE` (not `VENUE`) |
| Canonical minimum severity | `HARD` |
| Required evidence | resource key, capacity limit, concurrent sum, contributing `occupancyIds`, violation window |
| Blocks plan validity | Yes |
| Permitted action types | `REDUCE_CAPACITY_USAGE`, `MOVE_ASSIGNMENT_TIME`, `REASSIGN_COURT` / `REASSIGN_REFEREE` when kind matches, `MARK_FOR_MANUAL_REVIEW`, `NO_SAFE_AUTOMATIC_RESOLUTION` |
| Co-emission | **Not** with `VENUE_CAPACITY_EXCEEDED` for same root cause |

### 3.6 RESOURCE_UNAVAILABLE

| Field | Value |
|-------|-------|
| Meaning | Non-venue resource unavailable for occupancy window |
| Applicable `resourceKind` | Non-`VENUE` |
| Canonical minimum severity | `HARD` in `AUTHORITATIVE` mode; advisory/warning handling in `ADVISORY` per availability port |
| Required evidence | resource key, occupancy id(s), unavailable window or provider reason, availability mode |
| Blocks plan validity | Yes in authoritative hard path |
| Permitted action types | `MOVE_ASSIGNMENT_TIME`, kind-appropriate reassignment, `MARK_FOR_MANUAL_REVIEW`, `NO_SAFE_AUTOMATIC_RESOLUTION` |
| Co-emission | **Not** with `VENUE_UNAVAILABLE` for same root cause |

### 3.7 MANDATORY_REST_VIOLATION

| Field | Value |
|-------|-------|
| Meaning | Gap between consecutive occupancies on a resource is below mandatory rest |
| Applicable `resourceKind` | Typically `PLAYER`, `TEAM`, `REFEREE`; policy may extend |
| Canonical minimum severity | `HARD` |
| Required evidence | ordered pair `occupancyIds`, `gapMs`, `mandatoryRestMs`, policy version |
| Blocks plan validity | Yes |
| Permitted action types | `INSERT_REST_GAP`, `MOVE_ASSIGNMENT_TIME`, `MARK_FOR_MANUAL_REVIEW`, `NO_SAFE_AUTOMATIC_RESOLUTION` |
| Co-emission | Not emitted for pairs that already overlap (overlap wins) |

### 3.8 PREFERRED_REST_WARNING

| Field | Value |
|-------|-------|
| Meaning | Gap below preferred rest but at/above mandatory rest |
| Applicable `resourceKind` | Same as mandatory rest policy set |
| Canonical minimum severity | `SOFT` |
| Required evidence | ordered pair, `gapMs`, `preferredRestMs`, policy version |
| Blocks plan validity | No (warnings only) |
| Permitted action types | `INSERT_REST_GAP`, `MOVE_ASSIGNMENT_TIME`, `MARK_FOR_MANUAL_REVIEW`, `NO_SAFE_AUTOMATIC_RESOLUTION` |
| Co-emission | Not with mandatory rest for same pair |

### 3.9 VENUE_CAPACITY_EXCEEDED

| Field | Value |
|-------|-------|
| Meaning | Venue concurrent usage exceeds venue capacity |
| Applicable `resourceKind` | `VENUE` |
| Canonical minimum severity | `HARD` |
| Required evidence | venue resource key, capacity, concurrent sum, occupancy ids, violation window |
| Blocks plan validity | Yes |
| Permitted action types | `REDUCE_CAPACITY_USAGE`, `MOVE_ASSIGNMENT_TIME`, `MARK_FOR_MANUAL_REVIEW`, `NO_SAFE_AUTOMATIC_RESOLUTION` |
| Co-emission | **Not** with `RESOURCE_CAPACITY_EXCEEDED` |

### 3.10 VENUE_UNAVAILABLE

| Field | Value |
|-------|-------|
| Meaning | Venue unavailable for occupancy window |
| Applicable `resourceKind` | `VENUE` |
| Canonical minimum severity | `HARD` in authoritative mode |
| Required evidence | venue key, occupancy ids, unavailable window / reason, mode |
| Blocks plan validity | Yes in authoritative hard path |
| Permitted action types | `MOVE_ASSIGNMENT_TIME`, `MARK_FOR_MANUAL_REVIEW`, `NO_SAFE_AUTOMATIC_RESOLUTION` |
| Co-emission | **Not** with `RESOURCE_UNAVAILABLE` |

### 3.11 LOCATION_TIME_OVERLAP

| Field | Value |
|-------|-------|
| Meaning | Exclusive location has overlapping occupancies |
| Applicable `resourceKind` | `LOCATION` (exclusive) |
| Canonical minimum severity | `HARD` |
| Required evidence | location key, occupancy ids, violation window, exclusivity flag |
| Blocks plan validity | Yes |
| Permitted action types | `MOVE_ASSIGNMENT_TIME`, `MARK_FOR_MANUAL_REVIEW`, `NO_SAFE_AUTOMATIC_RESOLUTION` |
| Co-emission | If location uses capacity>1, use `RESOURCE_CAPACITY_EXCEEDED` instead of overlap — do not emit both |

---

## 4. Non-findings (explicit)

The following are **not** resource findings:

- `UNASSIGNED_MATCH`
- `INVALID_BYE_ASSIGNMENT`
- `INVALID_ROUND_ORDER`
- `DEPENDENCY_NOT_COMPLETED`
- All input diagnostic codes in [06_DIAGNOSTIC_CATALOG.md](./06_DIAGNOSTIC_CATALOG.md)

---

## 5. Emission uniqueness

For a given root cause tuple `(code family, resourceKey, sorted occupancyIds, violation window, policyVersion)`, CORE-14 emits **one** finding. Specialized venue codes replace generic ones; overlap vs capacity exclusivity is defined per kind in §3.
