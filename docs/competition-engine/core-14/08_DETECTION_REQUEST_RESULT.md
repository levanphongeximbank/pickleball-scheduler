# CORE-14 — Detection Request and Result

**Contract family:** `core14-detection-request-result-v1`
**Phase:** 1B / 1B-S — Contract Freeze
**Status:** Frozen
**Date:** 2026-07-22

---

## 1. Status separation (mandatory)

Do **not** overload a single `ok` field.

### EvaluationStatus (minimum)

| Value | Meaning |
|-------|---------|
| `COMPLETED` | Evaluation ran to completion on accepted inputs |
| `REJECTED_INVALID_INPUT` | Input failed validation; plan not evaluated |
| `DATA_UNAVAILABLE` | Required availability/capacity data missing (esp. authoritative) |
| `UNSUPPORTED` | Requested kind/policy/mode not supported |

### PlanStatus (minimum)

| Value | Meaning |
|-------|---------|
| `VALID` | Completed; no findings; availability certification `FULL` when availability was in scope |
| `VALID_WITH_WARNINGS` | Completed; only SOFT findings and/or partial availability certification without HARD findings |
| `INVALID_HARD_CONFLICTS` | Completed; one or more HARD findings |
| `NOT_EVALUATED` | Evaluation did not certify the plan |

### AvailabilityCertification (minimum)

| Value | Meaning |
|-------|---------|
| `FULL` | All required availability/capacity queries answered definitively under the active mode |
| `PARTIAL` | One or more answers were unknown, errored, or incomplete under `ADVISORY` (or soft disclosure) |
| `NOT_EVALUATED` | Availability was not certified (authoritative failure, rejected input, or availability not requested) |

---

## 2. DetectionRequest (minimum)

```text
DetectionRequest {
  requestId: string
  policyVersion: string
  evaluationScope: EvaluationScope
  occupancies: ResourceOccupancy[]
  availabilityMode: AUTHORITATIVE | ADVISORY
  availabilityPortRef: string | null
  capacityCheckEnabled: boolean
  restPolicy: RestPolicy | null
  severityOverrides: SeverityOverride[]   // raise-only
  requireAssignmentId: boolean            // when true → ASSIGNMENT_ID_MISSING if absent
  externalDiagnostics: ExternalDiagnostic[]
  deterministicContext: DeterministicContext
  metadata: Readonly<Record<string, unknown>> | null
}
```

### EvaluationScope (minimum)

```text
EvaluationScope {
  scopeType: GLOBAL | TENANT | CLUB | VENUE | COMPETITION | EVENT
  scopeId: string | null                  // required non-empty except GLOBAL; EVENT → canonical event identity
  competitionId: string | null            // required non-empty when scopeType = COMPETITION
  eventId: string | null                  // adapter-facing only; not a second canonical identity
}
```

Rules:

- `COMPETITION` scope requires stable `competitionId` (may equal `scopeId` when identical; both must be present and consistent if both supplied).
- `EVENT` scope: **`scopeId` is the canonical event identity**. Adapters may supply `eventId`. If both `eventId` and `scopeId` are supplied, they must match exactly; mismatch → `SCOPE_IDENTITY_MISMATCH`.
- Do not place a second canonical event identity on `ResourceOccupancy`.
- Missing required scope identity → `SCOPE_MISSING`.

### RestPolicy (minimum)

```text
RestPolicy {
  mandatoryRestMsByKind: Partial<Record<ResourceKind, number>>  // safe integers
  preferredRestMsByKind: Partial<Record<ResourceKind, number>>  // safe integers
  policyVersion: string
}
```

### DeterministicContext (minimum)

```text
DeterministicContext {
  fingerprintVersion: string            // CORE14_FP_V1
  compareContractVersion: string
  effectivePolicyVersion: string
}
```

Request objects are immutable after acceptance. CORE-14 must not read wall-clock time.

---

## 3. DetectionResult (minimum)

```text
DetectionResult {
  evaluationStatus: EvaluationStatus
  planStatus: PlanStatus
  findings: ResourceFinding[]           // alias conflicts[] permitted in adapters; canonical name findings
  inputDiagnostics: InputDiagnostic[]
  externalDiagnostics: ExternalDiagnostic[]  // echoed
  evaluatedOccupancyCount: number
  evaluatedResourceCount: number
  hardFindingCount: number
  softFindingCount: number
  unresolvedConflictCount: number
  recommendationCount: number
  recommendations: ResolutionRecommendation[]
  deterministicFingerprint: string
  metadata: DetectionResultMetadata
}
```

### DetectionResultMetadata (minimum)

```text
DetectionResultMetadata {
  policyVersion: string
  availabilityMode: AUTHORITATIVE | ADVISORY
  availabilityCertification: FULL | PARTIAL | NOT_EVALUATED
  availabilityFullyCertified: boolean   // derived: availabilityCertification === FULL
  providerVersions: string[]
  fingerprintVersion: string            // CORE14_FP_V1
}
```

---

## 4. Advisory availability status (frozen)

When `availabilityMode = ADVISORY` and the provider returns unknown, error, or unavailable data:

1. Do **not** treat the resource as available.
2. Include `AVAILABILITY_DATA_UNAVAILABLE` (or the applicable diagnostic).
3. Set `availabilityCertification = PARTIAL`.
4. Do **not** return `planStatus = VALID` solely because no other conflict was found.

When evaluation otherwise completes without HARD findings:

```text
evaluationStatus = COMPLETED
planStatus       = VALID_WITH_WARNINGS
availabilityCertification = PARTIAL
```

### Authoritative failure (unchanged)

```text
evaluationStatus = DATA_UNAVAILABLE
planStatus       = NOT_EVALUATED
availabilityCertification = NOT_EVALUATED
```

### Full certification path

`planStatus = VALID` is permitted only when:

- `evaluationStatus = COMPLETED`
- no findings (hard or soft)
- `availabilityCertification = FULL` when availability checking was in scope for the request
  (If availability checking was not requested, certification may be `NOT_EVALUATED` and `VALID` refers to occupancy/rest/capacity findings only — request metadata must disclose this.)

---

## 5. Examples

### Court overlap successfully evaluated

```text
evaluationStatus = COMPLETED
planStatus       = INVALID_HARD_CONFLICTS
```

### Availability provider failure in authoritative mode

```text
evaluationStatus = DATA_UNAVAILABLE
planStatus       = NOT_EVALUATED
availabilityCertification = NOT_EVALUATED
```

### Advisory unknown availability, no hard occupancy conflicts

```text
evaluationStatus = COMPLETED
planStatus       = VALID_WITH_WARNINGS
availabilityCertification = PARTIAL
```

### Preferred rest only (full availability)

```text
evaluationStatus = COMPLETED
planStatus       = VALID_WITH_WARNINGS
availabilityCertification = FULL
```

### Invalid interval in request

```text
evaluationStatus = REJECTED_INVALID_INPUT
planStatus       = NOT_EVALUATED
```

---

## 6. Count rules

| Field | Rule |
|-------|------|
| `evaluatedOccupancyCount` | Occupancies accepted into evaluation after normalize |
| `evaluatedResourceCount` | Distinct `CanonicalResourceKey` count evaluated |
| `hardFindingCount` | Findings with effective severity HARD |
| `softFindingCount` | Findings with effective severity SOFT |
| `unresolvedConflictCount` | On detection-only results: equals `hardFindingCount`; after validation: HARD findings still open |
| `recommendationCount` | `recommendations.length` |

When `evaluationStatus !== COMPLETED`, finding counts are `0` and `planStatus` is `NOT_EVALUATED`.
