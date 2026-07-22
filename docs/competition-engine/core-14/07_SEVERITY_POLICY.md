# CORE-14 — Severity and Capacity Policy

**Contract family:** `core14-severity-capacity-v1`
**Phase:** 1B / 1B-S — Contract Freeze
**Status:** Frozen
**Date:** 2026-07-22

---

## 1. Severity enum

```text
Severity = HARD | SOFT | INFO
```

Phase 1C freezes `INFO` as an immutable constant. V1 finding minimum-severity policy continues to emit `HARD` / `SOFT` only; `INFO` is reserved for future versioned emission.

---

## 2. Canonical HARD minimum set

| Finding code | Notes |
|--------------|-------|
| `PLAYER_TIME_OVERLAP` | Always HARD minimum |
| `TEAM_TIME_OVERLAP` | Always HARD minimum |
| `COURT_TIME_OVERLAP` | Always HARD minimum |
| `REFEREE_TIME_OVERLAP` | Always HARD minimum |
| `RESOURCE_CAPACITY_EXCEEDED` | Always HARD minimum |
| `RESOURCE_UNAVAILABLE` | Canonical minimum HARD when `availabilityMode=AUTHORITATIVE` |
| `MANDATORY_REST_VIOLATION` | Always HARD minimum |
| `VENUE_CAPACITY_EXCEEDED` | Always HARD minimum |
| `VENUE_UNAVAILABLE` | Canonical minimum HARD when `availabilityMode=AUTHORITATIVE` |
| `LOCATION_TIME_OVERLAP` | HARD for exclusive locations |

Mode-dependent availability minima (Phase 1D freeze):

| Finding code | `AUTHORITATIVE` | `ADVISORY` |
|--------------|-----------------|------------|
| `RESOURCE_UNAVAILABLE` | HARD | SOFT |
| `VENUE_UNAVAILABLE` | HARD | SOFT |

This is the frozen canonical minimum selected by availability mode — not a caller downgrade.

---

## 3. Canonical SOFT set

| Finding code | Notes |
|--------------|-------|
| `PREFERRED_REST_WARNING` | SOFT minimum |
| `RESOURCE_UNAVAILABLE` | SOFT when `availabilityMode=ADVISORY` |
| `VENUE_UNAVAILABLE` | SOFT when `availabilityMode=ADVISORY` |

---

## 4. Caller severity rules

1. Caller **may raise** severity (e.g., treat preferred rest as HARD via request policy).
2. Caller **must never lower** severity below canonical minimum.
3. Attempted downgrade:

   - is rejected
   - retains canonical severity
   - emits `SEVERITY_DOWNGRADE_REJECTED`
   - remains deterministic

```text
effectiveSeverity = max(canonicalMinimum, callerRequestedSeverity)
// where HARD > SOFT
```

---

## 5. Plan validity mapping

| Effective findings / certification | `planStatus` (when `evaluationStatus=COMPLETED`) |
|------------------------------------|--------------------------------------------------|
| No findings AND `availabilityCertification=FULL` (or availability not in scope per request disclosure) | `VALID` |
| Only SOFT findings | `VALID_WITH_WARNINGS` |
| No HARD findings AND `availabilityCertification=PARTIAL` | `VALID_WITH_WARNINGS` (never `VALID` solely due to missing conflicts) |
| Any HARD finding | `INVALID_HARD_CONFLICTS` |

---

## 6. Occupancy capacityUnits vs resource capacity limit

Every `ResourceOccupancy` **always** carries `capacityUnits` (finite, `> 0`) — see [03_RESOURCE_OCCUPANCY.md](./03_RESOURCE_OCCUPANCY.md).

Separately, the **resource capacity limit** used when capacity checking is enabled:

| `resourceKind` | Default capacity limit when capacity checking enabled |
|----------------|--------------------------------------------------------|
| `PLAYER` | `1` |
| `TEAM` | `1` |
| `COURT` | `1` |
| `REFEREE` | `1` |
| `LOCATION` | `1` when exclusive |
| `VENUE` | **No hidden default** — must come from authoritative provider or explicit policy when capacity checking requested |
| `EQUIPMENT` | Must be supplied when capacity checking enabled; missing → fail closed (`CAPACITY_MISSING`) |
| `CUSTOM_RESOURCE` | Must be supplied when capacity checking enabled; missing → fail closed |

---

## 7. Concurrency event scanning

For a single `CanonicalResourceKey`, build an event list:

```text
for each occupancy o:
  emit { t: o.startMs, delta: +o.capacityUnits, occupancyId }
  emit { t: o.endMs,   delta: -o.capacityUnits, occupancyId }  // half-open end
```

Sort events by:

1. `t` ascending
2. at equal `t`: process releases (`delta < 0`) before acquires (`delta > 0`) so adjacent intervals do not accumulate
3. then `occupancyId` ascending for determinism

Scan:

```text
active = 0
for event in sortedEvents:
  active += event.delta
  if active > capacity:
    emit capacity exceedance covering contiguous active>capacity span
```

`capacityUnits` summation uses finite numeric addition only. Non-finite or `<= 0` units fail closed before scan (`INVALID_CAPACITY`).

---

## 8. Venue independence note

Independent courts at the same venue do **not** conflict merely by sharing `venueId`. Venue-level findings require venue resource occupancy/capacity/availability evaluation on a `VENUE` resource key.
