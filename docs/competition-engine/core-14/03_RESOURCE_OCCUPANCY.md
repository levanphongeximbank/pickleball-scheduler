# CORE-14 — ResourceOccupancy

**Contract family:** `core14-resource-occupancy-v1`
**Phase:** 1B / 1B-S — Contract Freeze
**Status:** Frozen
**Date:** 2026-07-22

---

## 1. Shape

```text
ResourceOccupancy {
  occupancyId: string
  resourceKey: CanonicalResourceKey
  assignmentId: string | null
  activityId: string | null
  matchId: string | null
  competitionId: string | null
  venueId: string | null
  startMs: number                 // Number.isSafeInteger
  endMs: number                   // Number.isSafeInteger; startMs < endMs
  capacityUnits: number           // always required; Number.isSafeInteger && > 0
  locked: boolean
  published: boolean
  source: OccupancySource
  metadata: Readonly<Record<string, unknown>> | null
}
```

Canonical domain time fields are **JavaScript-safe integer epoch milliseconds** only.
Do **not** retain `string | number` as the canonical domain type.

**EVENT identity:** When `resourceKey.scopeType = EVENT`, `resourceKey.scopeId` is the canonical event identity. Do **not** add a second event identity field on `ResourceOccupancy`. See [15_PHASE_1C_FINAL_CONTRACT_CORRECTIONS.md](./15_PHASE_1C_FINAL_CONTRACT_CORRECTIONS.md).

---

## 2. OccupancySource (provenance)

`source` is a **non-empty, case-sensitive provenance string**.

Well-known convenience constants (not a closed allowlist):

| Value | Meaning |
|-------|---------|
| `SCHEDULE` | From schedule / time assignment |
| `COURT_ASSIGNMENT` | From court assignment |
| `REFEREE_ASSIGNMENT` | From referee assignment |
| `MANUAL` | Explicit caller-supplied occupancy |
| `EXTERNAL` | External system projection |
| `PROJECTED` | Dry-run projected occupancy (validation only) |
| `CORE_11` | CORE-11 scheduling provenance |
| `CORE_12` | CORE-12 court provenance |
| `CORE_13` | CORE-13 referee provenance |
| `LEGACY_CC09` | Legacy CC-09 provenance |
| `ADAPTER` | Generic adapter provenance |

Extensible examples such as `EXTERNAL_ADAPTER:<namespace>` are valid without changing the `ResourceOccupancy` contract.

Rules:

- Do not silently trim, lowercase, or Unicode-normalize `source`.
- `source` is excluded from `CanonicalResourceKey`, `LogicalAssignmentKeyV1`, and duplicate-concealing identity.

---

## 3. Always-required fields

These fields are **always required** on every occupancy after normalize:

| Field | Rules |
|-------|-------|
| `occupancyId` | Non-empty string; stable within the evaluation; externally supplied or adapter-derived **before** CORE-14 entry. No `Date.now()` / `Math.random()`. Identity must not be silently trimmed, lower-cased, Unicode-normalized, or locale-transformed. |
| `resourceKey` | Valid `CanonicalResourceKey` |
| `startMs` | `Number.isSafeInteger(startMs)` |
| `endMs` | `Number.isSafeInteger(endMs)` and `startMs < endMs` |
| `capacityUnits` | Always present; must satisfy `Number.isSafeInteger(capacityUnits) && capacityUnits > 0`. Fractional capacity unsupported in V1. Else `INVALID_CAPACITY` / `CAPACITY_MISSING` |
| `locked` | Boolean; adapter may default omitted → `false` **before** CORE-14 entry; after normalize, always present |
| `published` | Boolean; adapter may default omitted → `false` **before** CORE-14 entry; after normalize, always present |
| `source` | Non-empty case-sensitive provenance string (extensible; well-known constants optional) |

Missing time → `TIME_WINDOW_MISSING`. Invalid time → `INVALID_TIME_INTERVAL`.

---

## 4. Activity identity requirement

At least **one** of the following must be a non-empty string:

- `assignmentId`
- `activityId`
- `matchId`

If all three are absent (`null` / missing / empty):

→ fail closed with **`ACTIVITY_IDENTITY_MISSING`**

### `ASSIGNMENT_ID_MISSING`

Use **only** when the requesting contract / policy specifically requires `assignmentId` (for example recommendation targeting or assignment-move validation).

Do not use `ASSIGNMENT_ID_MISSING` as the generic stand-in for missing activity identity.

---

## 5. Scope and context fields

| Field | Requiredness |
|-------|----------------|
| `competitionId` | **Required** (non-empty) on occupancy and/or request envelope when evaluation `scopeType` / evaluation scope is `COMPETITION`. Missing → `SCOPE_MISSING` (or request-scope diagnostic). |
| Event identity | When `scopeType = EVENT`, canonical identity is `scopeId` on `CanonicalResourceKey` / evaluation scope. Adapters may receive `eventId`; if both `eventId` and `scopeId` are supplied they must match exactly or fail with `SCOPE_IDENTITY_MISMATCH`. Missing required identity → `SCOPE_MISSING`. |
| `venueId` | **Optional context only.** Must **not** replace `CanonicalResourceKey` or scope identity. Same `venueId` alone must not create a conflict. |

---

## 6. Optional / conditional fields (summary)

| Field | Notes |
|-------|-------|
| `assignmentId` | Optional unless contract requires it; contributes to activity identity when non-empty |
| `activityId` | Optional; contributes to activity identity when non-empty |
| `matchId` | Optional; contributes to activity identity when non-empty |
| `competitionId` | Per §5 |
| `venueId` | Context only |
| `metadata` | Optional; excluded from identity/fingerprint unless an explicitly versioned schema allow-lists fields |

---

## 7. Invariants

1. Caller input **must not** be mutated. Normalize into internal frozen copies.
2. `Number.isSafeInteger(startMs) && Number.isSafeInteger(endMs) && startMs < endMs`.
3. `capacityUnits` always present, `Number.isSafeInteger`, and `> 0`.
4. Duplicate `occupancyId` → `DUPLICATE_OCCUPANCY_ID` (primary).
5. Different `occupancyId`s sharing the same `LogicalAssignmentKeyV1` → `DUPLICATE_ASSIGNMENT` (`source` is provenance only and must not conceal duplicates).
6. If both duplicate diagnostics apply to the same records, emit **`DUPLICATE_OCCUPANCY_ID` as primary** and avoid duplicate root-cause reporting unless materially distinct evidence exists.

See [06_DIAGNOSTIC_CATALOG.md](./06_DIAGNOSTIC_CATALOG.md).

---

## 8. Occupancy index key (separate from CanonicalResourceKey)

```text
OccupancyIndexKey {
  resourceKey: CanonicalResourceKey
  occupancyId: string
}
```

Serialization (`CORE14_OIK_V1`):

```text
CORE14_OIK_V1|rk=<canonicalResourceKeySerialization>|oid=<escape(occupancyId)>
```

Time is **not** part of the index key. Interval lookup uses secondary time indexes keyed by resource.

---

## 9. Adapter inputs (non-canonical)

The following may appear only in adapters, never as domain occupancy fields:

- ISO-8601 strings
- local civil date/time
- timezone identifiers
- `slotId`
- date-only fields
- string-form numbers

Adapters must resolve to safe-integer `startMs` / `endMs` before CORE-14 evaluation. Unresolved slot → `SLOT_RESOLUTION_FAILED` (fail closed).

---

## 10. Relationship to findings

Findings reference:

- one `CanonicalResourceKey`
- one or more `occupancyId`s
- optional violation `[startMs, endMs)`

See [05_RESOURCE_FINDING_CATALOG.md](./05_RESOURCE_FINDING_CATALOG.md).
