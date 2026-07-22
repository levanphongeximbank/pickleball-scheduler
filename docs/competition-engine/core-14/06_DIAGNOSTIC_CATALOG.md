# CORE-14 — Diagnostic Catalogs

**Contract family:** `core14-diagnostic-catalog-v1`
**Phase:** 1B / 1B-S — Contract Freeze
**Status:** Frozen
**Date:** 2026-07-22

---

## 1. Separation of concerns

| Class | Owner | Appears on result as | Classifies plan conflicts? |
|-------|-------|----------------------|----------------------------|
| Resource findings | CORE-14 | `findings` / `conflicts` | Yes (per severity) |
| Input diagnostics | CORE-14 validation | `inputDiagnostics` | No — may reject evaluation |
| External diagnostics | Schedule / workflow / other cores | `externalDiagnostics` (echo) | No — CORE-14 does not own semantics |

**Do not** classify all validation errors as resource conflicts.

---

## 2. Input diagnostic codes (CORE-14)

| Code | Meaning | Typical `evaluationStatus` |
|------|---------|----------------------------|
| `RESOURCE_ID_MISSING` | Empty/missing `resourceId` | `REJECTED_INVALID_INPUT` |
| `ACTIVITY_IDENTITY_MISSING` | All of `assignmentId`, `activityId`, and `matchId` absent/empty | `REJECTED_INVALID_INPUT` |
| `ASSIGNMENT_ID_MISSING` | `assignmentId` absent when the requesting contract specifically requires it | `REJECTED_INVALID_INPUT` |
| `TIME_WINDOW_MISSING` | Missing `startMs`/`endMs` | `REJECTED_INVALID_INPUT` |
| `INVALID_TIME_INTERVAL` | Not safe-integer epoch ms, or `startMs >= endMs` | `REJECTED_INVALID_INPUT` |
| `UNKNOWN_RESOURCE_TYPE` | Unknown `resourceKind` | `REJECTED_INVALID_INPUT` or `UNSUPPORTED` |
| `DUPLICATE_OCCUPANCY_ID` | Same `occupancyId` appears more than once in one evaluation request | `REJECTED_INVALID_INPUT` |
| `DUPLICATE_ASSIGNMENT` | Different occupancy records represent the same logical assignment/reservation more than once | `REJECTED_INVALID_INPUT` |
| `SCOPE_MISSING` | Required scope / competition / event identity missing | `REJECTED_INVALID_INPUT` |
| `SCOPE_IDENTITY_MISMATCH` | Adapter `eventId` and EVENT `scopeId` both supplied but not exactly equal | `REJECTED_INVALID_INPUT` |
| `AVAILABILITY_DATA_UNAVAILABLE` | Availability provider failed, unknown, or incomplete when certification required | See §4 |
| `CAPACITY_MISSING` | `capacityUnits` or provider capacity required but absent | `REJECTED_INVALID_INPUT` or `DATA_UNAVAILABLE` per mode |
| `INVALID_CAPACITY` | Non-finite or `<= 0` capacity / `capacityUnits` | `REJECTED_INVALID_INPUT` |
| `SEVERITY_DOWNGRADE_REJECTED` | Caller attempted to lower below canonical minimum | Evaluation may still `COMPLETED`; diagnostic mandatory |
| `SLOT_RESOLUTION_FAILED` | Adapter could not resolve `slotId` | `REJECTED_INVALID_INPUT` |
| `OCCUPANCY_ID_MISSING` | Required `occupancyId` absent or empty | `REJECTED_INVALID_INPUT` |
| `OCCUPANCY_SOURCE_MISSING` | Required occupancy `source` provenance absent or empty / non-string | `REJECTED_INVALID_INPUT` |
| `OCCUPANCY_BOOLEAN_INVALID` | `locked` or `published` is not a boolean | `REJECTED_INVALID_INPUT` |
| `OCCUPANCY_METADATA_INVALID` | `metadata` present but not a plain object | `REJECTED_INVALID_INPUT` |
| `UNSUPPORTED_CANONICAL_VALUE` | Canonical serializer received unsupported type/number representation | Fail closed (throw or reject fingerprint material) |

### Evidence schemas (Phase 1C-S additions)

**`OCCUPANCY_ID_MISSING` / `OCCUPANCY_SOURCE_MISSING` / `OCCUPANCY_BOOLEAN_INVALID` / `OCCUPANCY_METADATA_INVALID`:**

```text
{
  fieldName: string
  expectedType: string
  actualType: string
}
```

**`UNSUPPORTED_CANONICAL_VALUE`:**

```text
{
  valuePath: string
  valueType: string
  reason: string   // e.g. NON_SAFE_INTEGER | UNSUPPORTED_TYPE | CYCLIC_REFERENCE
}
```

`INVALID_OCCUPANCY_FIELD` is **not** a catalog code (retired in Phase 1C-S).

### Input diagnostic envelope

```text
InputDiagnostic {
  code: InputDiagnosticCode
  message: string                 // stable English machine message; no locale formatting
  path: string | null             // deterministic JSON-pointer-like path when applicable
  resourceKey: CanonicalResourceKey | null
  occupancyId: string | null
  assignmentId: string | null
  details: Readonly<Record<string, unknown>> | null
}
```

---

## 3. Duplicate diagnostics (distinct)

### 3.1 `DUPLICATE_OCCUPANCY_ID`

**Meaning:** The same `occupancyId` appears more than once in one evaluation request, whether the duplicated records are equal or different.

**Deterministic evidence (`details` minimum):**

```text
{
  occupancyId: string
  occurrenceCount: number              // safe integer >= 2
  occurrenceIndexesSorted: number[]    // 0-based indexes into request.occupancies, ascending
}
```

**Primary integrity diagnostic** for repeated occupancy identity.

### 3.2 `DUPLICATE_ASSIGNMENT`

**Meaning:** Different occupancy records (distinct `occupancyId`s) share the same `LogicalAssignmentKeyV1`.

```text
LogicalAssignmentKeyV1 = {
  resourceKey,                 // CanonicalResourceKey (CORE14_CRK_V1 material)
  activityIdentityType,        // ASSIGNMENT_ID | ACTIVITY_ID | MATCH_ID
  activityIdentityValue        // first non-empty among assignmentId → activityId → matchId
}
```

Rules (Phase 1C final):

- `resourceKey` is part of logical assignment identity.
- `source` is provenance only and **must not** conceal duplicates.
- Adapters must namespace-qualify externally non-unique IDs before CORE-14 entry.
- Same match on **different** resources yields different keys (not a duplicate assignment).

**Deterministic evidence (`details` minimum):**

```text
{
  logicalAssignmentKeyCanonical: string   // CORE14_LAK_V1
  activityIdentityType: string
  activityIdentityValue: string
  occupancyIdsSorted: string[]            // UTF-8 bytewise ascending
  occurrenceIndexesSorted: number[]
}
```

### 3.3 Precedence

1. Detect `DUPLICATE_OCCUPANCY_ID` first.
2. Detect `DUPLICATE_ASSIGNMENT` among remaining distinct occupancy ids.
3. If both apply to the same records, emit **`DUPLICATE_OCCUPANCY_ID` as the primary** input-integrity diagnostic and **avoid duplicate root-cause reporting** unless materially distinct evidence exists (for example a second pair that only shares `assignmentId` without shared `occupancyId`).

Both codes yield `evaluationStatus = REJECTED_INVALID_INPUT` and `planStatus = NOT_EVALUATED`.

---

## 4. Availability-related diagnostics vs findings

| Situation | Mode | Emit / status |
|-----------|------|----------------|
| Provider hard failure / unknown | `AUTHORITATIVE` | `AVAILABILITY_DATA_UNAVAILABLE` + `evaluationStatus=DATA_UNAVAILABLE`, `planStatus=NOT_EVALUATED`, `availabilityCertification=NOT_EVALUATED` |
| Provider failure / unknown / unavailable data | `ADVISORY` | Include `AVAILABILITY_DATA_UNAVAILABLE` (or applicable diagnostic); do **not** treat resource as available; disclose `availabilityCertification=PARTIAL`; if evaluation otherwise completes with no HARD findings → `evaluationStatus=COMPLETED`, `planStatus=VALID_WITH_WARNINGS` (never `VALID` solely because no other conflict was found) |
| Resource known unavailable | `AUTHORITATIVE` | finding `RESOURCE_UNAVAILABLE` or `VENUE_UNAVAILABLE` |
| Resource known unavailable | `ADVISORY` | finding or warning per policy; certification remains partial unless fully known |

See [08_DETECTION_REQUEST_RESULT.md](./08_DETECTION_REQUEST_RESULT.md) and [11_AVAILABILITY_PORT.md](./11_AVAILABILITY_PORT.md).

---

## 5. External diagnostics (not owned by CORE-14)

Schedule and workflow diagnostics remain externally owned, including at minimum:

| Code | Owner (illustrative) |
|------|----------------------|
| `UNASSIGNED_MATCH` | Schedule / assignment workflow |
| `INVALID_BYE_ASSIGNMENT` | Match generation / draw workflow |
| `INVALID_ROUND_ORDER` | Schedule / match plan workflow |
| `DEPENDENCY_NOT_COMPLETED` | Match dependency / workflow |

### Echo policy

CORE-14 **may** echo caller-supplied `externalDiagnostics` unchanged in the result envelope for transport convenience.

CORE-14:

- does **not** reinterpret them as resource findings
- does **not** claim ownership of their semantics
- does **not** use them alone to set `planStatus` resource-conflict states
- must not drop or mutate codes/messages when echoing

---

## 6. Severity downgrade diagnostic

When a caller requests severity below canonical minimum:

1. Reject the downgrade
2. Retain canonical severity on the finding
3. Emit `SEVERITY_DOWNGRADE_REJECTED`
4. Remain deterministic (same inputs → same diagnostic + finding)

See [07_SEVERITY_POLICY.md](./07_SEVERITY_POLICY.md).
