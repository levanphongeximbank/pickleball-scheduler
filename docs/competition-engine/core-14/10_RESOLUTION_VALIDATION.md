# CORE-14 — Resolution Validation (Dry-Run)

**Contract family:** `core14-resolution-validation-v1`
**Phase:** 1B / 1B-S — Contract Freeze
**Status:** Frozen
**Date:** 2026-07-22

---

## 1. Purpose

Validate one or more `ResolutionRecommendation`s by projecting occupancies and re-running detection **without** applying changes to caller state.

---

## 2. ValidationRequest (minimum)

```text
ValidationRequest {
  requestId: string
  baseDetectionRequest: DetectionRequest
  baseDetectionResult: DetectionResult
  recommendations: ResolutionRecommendation[]
  limits: ValidationLimits | null
  policyVersion: string
}
```

```text
ValidationLimits {
  maxShiftMinutes: number | null
  maxChangedAssignments: number | null
  allowLockedMutation: boolean          // default false
  allowPublishedMutation: boolean       // default false
}
```

---

## 3. ValidationResult (minimum)

```text
ValidationResult {
  evaluationCompleted: boolean
  evaluationStatus: EvaluationStatus
  planStatus: PlanStatus
  originalConflictsResolved: boolean
  resolvedConflictIds: string[]
  unresolvedConflictIds: string[]
  secondaryConflictIds: string[]
  lockedAssignmentsAffected: boolean
  publishedAssignmentsAffected: boolean
  maxShiftExceeded: boolean
  maxChangeExceeded: boolean
  requiresManualApproval: boolean
  projectedOccupancies: ResourceOccupancy[]
  projectedFindings: ResourceFinding[]
  diagnostics: InputDiagnostic[]
  deterministicFingerprint: string
  metadata: Readonly<Record<string, unknown>> | null
}
```

---

## 4. Projection rules

1. Start from a **deep copy** of accepted base occupancies.
2. Apply recommendation deltas onto the copy only.
3. Projected occupancies are **new values** and must **not** alias-mutate caller input.
4. `source` on projected rows should be `PROJECTED` (or metadata flag) for audit clarity.
5. Re-run detection on projected occupancies with the same policy/availability mode.

---

## 5. Outcome definitions

| Field | Definition |
|-------|------------|
| `originalConflictsResolved` | Every `expectedResolvedConflictIds` across accepted recommendations is absent from projected HARD findings (and matching IDs cleared) |
| `unresolvedConflictIds` | Original HARD finding IDs still present (or equivalent root-cause IDs still open) |
| `secondaryConflictIds` | New HARD finding IDs not in the original HARD set |
| `requiresManualApproval` | Any recommendation requires manual approval OR limits forbid auto apply OR locked/published affected while disallowed |

If projection inputs are invalid, `evaluationCompleted=false`, `evaluationStatus` reflects rejection/unavailability, `planStatus=NOT_EVALUATED`.

---

## 6. Mutation safety contract

Tests must prove:

- caller `occupancies` array and objects are unchanged by reference and deep value
- projected array identity ≠ caller array identity
- nested `resourceKey` / metadata objects are not shared mutable references unless deeply frozen and read-only

---

## 7. Fingerprint

Validation fingerprint includes:

- base detection fingerprint
- sorted recommendation IDs + canonical proposed changes
- projected finding identity set
- policy / fingerprint versions

See [13_DETERMINISM_AND_FINGERPRINT.md](./13_DETERMINISM_AND_FINGERPRINT.md).
