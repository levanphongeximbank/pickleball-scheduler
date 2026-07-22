# CORE-14 — Canonical Time Model

**Contract family:** `core14-canonical-time-v1`
**Phase:** 1B / 1B-S — Contract Freeze
**Status:** Frozen
**Date:** 2026-07-22

---

## 1. Domain time type (JavaScript-safe integer epoch ms)

Canonical domain time uses **JavaScript-safe integer epoch milliseconds** (UTC instant):

```text
startMs: number   // must satisfy Number.isSafeInteger(startMs)
endMs: number     // must satisfy Number.isSafeInteger(endMs)
startMs < endMs
```

### Required predicates

```text
Number.isSafeInteger(startMs) === true
Number.isSafeInteger(endMs) === true
startMs < endMs
```

### Reject (fail closed → `INVALID_TIME_INTERVAL` or `TIME_WINDOW_MISSING`)

| Rejected value | Reason |
|----------------|--------|
| `NaN` | Not a safe integer |
| `±Infinity` | Not a safe integer |
| Fractional milliseconds (e.g. `1.5`) | Not an integer |
| Values outside `Number.MIN_SAFE_INTEGER` … `Number.MAX_SAFE_INTEGER` | Outside safe-integer range |
| String-form numbers (e.g. `"1000"`) | Forbidden in canonical domain (`string` is not `number`) |
| `string \| number` unions as domain type | Forbidden |

Forbidden as canonical domain types:

- `string | number` unions
- `Date` object identity
- timezone-dependent civil strings inside CORE-14

---

## 2. Interval semantics (half-open)

Every occupancy occupies:

```text
[startMs, endMs)
```

Rules:

1. `startMs < endMs` is mandatory.
2. Instantaneous intervals (`startMs === endMs`) are invalid.
3. Detector compares intervals only after both ends are validated safe integers.

---

## 3. Overlap predicate

Intervals A and B overlap iff:

```text
startA < endB && startB < endA
```

### Adjacent non-conflict

If `endA === startB` (or `endB === startA`), intervals are **adjacent** and **do not conflict**.

Examples:

| A | B | Result |
|---|---|--------|
| `[100, 200)` | `[150, 250)` | Overlap |
| `[100, 200)` | `[200, 300)` | No conflict (adjacent) |
| `[100, 200)` | `[200, 200)` | B invalid |
| `[100, 200)` | `[50, 100)` | No conflict (adjacent) |

---

## 4. Slot rules

| Rule | Contract |
|------|----------|
| `slotId` ownership | Adapter input only |
| Resolution | Adapter must resolve `slotId` → `{ startMs, endMs }` safe integers |
| Unresolved slot | Fail closed → `SLOT_RESOLUTION_FAILED` |
| Competing sources | Slot and interval are **not** equal competing sources of truth inside CORE-14 |

ISO strings, civil date/time, timezone data, and slot identifiers remain **adapter inputs only**.

If both slot and interval are supplied to an adapter, the adapter policy must choose one resolution path and record it; CORE-14 receives only the resolved safe-integer interval.

---

## 5. Duration rules

1. **No implicit duration.** Missing end time is not filled by guessing.
2. Explicit default duration may be supplied **only** by a versioned request policy (`DetectionPolicy.defaultDurationMs`), and that duration must itself be a safe integer `> 0`.
3. When an explicit default duration is applied by an adapter/policy preprocessor, a diagnostic must record policy version and applied duration.
4. Detector must **not** parse timezone-dependent strings.

---

## 6. Rest gap measurement

Rest between occupancy A ending and occupancy B starting on the same resource:

```text
gapMs = startB - endA   // when endA <= startB; result is a safe integer under valid inputs
```

If intervals overlap, rest is not applicable; overlap findings take precedence over rest findings for the overlapping pair.

Mandatory vs preferred rest thresholds are policy-versioned; see [07_SEVERITY_POLICY.md](./07_SEVERITY_POLICY.md).

---

## 7. Violation window

When a finding spans overlapping occupancies, `violationStartMs` / `violationEndMs` are:

```text
violationStartMs = max(startA, startB, ...)
violationEndMs   = min(endA, endB, ...)
```

Both must be safe integers. For multi-occupancy capacity exceedance, the violation window is the maximal contiguous interval where concurrent `capacityUnits` sum exceeds capacity (see [07_SEVERITY_POLICY.md](./07_SEVERITY_POLICY.md)).

---

## 8. Forbidden detector behaviors

- Calling `Date.now()` for evaluation time
- Locale calendar arithmetic
- Assuming local midnight boundaries
- Treating `venueId` equality as a time conflict
- Using database insertion order to order time events
- Coercing strings to numbers inside CORE-14
