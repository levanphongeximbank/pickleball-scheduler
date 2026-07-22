# CORE-10 — Public Contracts

**Schema version:** `CORE10_OPTIMIZER_SCHEMA_V1`
**Module:** `src/features/competition-core/optimizer/contracts/`

Phase 1B defines immutable contract factories and strict allowlisted validators.
Unknown fields fail closed where a strict schema applies.
Replay-certified inputs reject functions, `Date`, `Map`, `Set`, `undefined`, `NaN`, and `Infinity`.

---

## Contract corrections (Owner-approved)

| Incorrect framing | Required representation |
|-------------------|-------------------------|
| `OBJ_HARD_FEASIBILITY` | **Not an objective.** Hard feasibility is a mandatory gate before objective ranking. |
| `OBJ_MATCHPLAN_INTEGRITY` | **Not an objective.** Fingerprint / snapshot integrity is structural validation. |
| `OBJ_SEARCH_STABILITY` | **Not an objective.** Stable candidate ID comparison is the final deterministic tie-break. |

Do not invent business objectives (skill balance, fairness, …) in Phase 1B — only generic shapes / registry hooks.

---

## Canonical shapes

### OptimizationRequest

| Field | Required | Notes |
|-------|----------|-------|
| `schemaVersion` | yes | Must match engine schema version |
| `requestId` | yes | Stable opaque ID |
| `tenantId` | yes | Tenant scope |
| `competitionId` | yes | Competition scope |
| `operation` | yes | Generic operation identifier |
| `policy` | yes | `OptimizationPolicy` |
| `context` | yes | `OptimizationContext` |
| `decisionVariables` | yes | Array of `DecisionVariable` |
| `seed` | yes when PRNG used | Explicit; missing/invalid fails closed |
| `deterministicBudget` | yes | `{ maxNodes?, maxCandidates?, maxEvaluations? }` integers ≥ 0 |
| `strategy` | yes | Solver strategy identifier |

Strict: reject unknown top-level fields.

### OptimizationContext

| Field | Required | Notes |
|-------|----------|-------|
| `tenantId` | yes | Must equal request.tenantId |
| `competitionId` | yes | Must equal request.competitionId |
| `snapshotRefs` | yes | Versioned snapshot references with fingerprints |
| `metadata` | no | Canonical plain object only |

Each snapshot ref: `{ snapshotId, snapshotVersion, fingerprint, kind? }`.

### OptimizationPolicy

| Field | Required | Notes |
|-------|----------|-------|
| `policyId` | yes | Stable ID |
| `policyVersion` | yes | Version string |
| `objectiveKeys` | yes | Declared lexicographic objective order (soft / scored keys only) |
| `authorityKeys` | no | Optional priority keys before objectives |
| `comparatorVersion` | yes | Must match engine comparator version |
| `quantizeScale` | yes | Positive integer for quantized scoring |

Hard constraints are **not** listed as objectives.

### OptimizationOperation

| Field | Required | Notes |
|-------|----------|-------|
| `operationId` | yes | Must be a supported generic operation identifier |
| `params` | no | Canonical plain object; no domain algorithm ownership claimed |

### DecisionVariable

| Field | Required | Notes |
|-------|----------|-------|
| `variableId` | yes | Stable ID |
| `domain` | yes | Non-empty array of allowed canonical values |
| `required` | yes | Boolean |

### CandidateSolution

| Field | Required | Notes |
|-------|----------|-------|
| `candidateId` | yes | Stable ID (final tie-break) |
| `assignments` | yes | Map-like plain object: variableId → domain value |
| `feasible` | yes | Boolean gate result (not an objective) |
| `hardViolationCount` | yes | Non-negative integer |
| `constraintEvaluations` | no | Array of `ConstraintEvaluation` |
| `objectiveEvaluations` | no | Array of `ObjectiveEvaluation` |
| `score` | no | `OptimizationScore` when ranked |

Assignments must lie inside declared decision domains (structural check).

### ConstraintEvaluation

| Field | Required | Notes |
|-------|----------|-------|
| `constraintId` | yes | Stable ID |
| `kind` | yes | `HARD` or `SOFT` |
| `satisfied` | yes | Boolean |
| `violationMagnitude` | yes | Non-negative quantized integer |
| `message` | no | Diagnostic string |

### ObjectiveEvaluation

| Field | Required | Notes |
|-------|----------|-------|
| `objectiveKey` | yes | Must appear in policy.objectiveKeys when scored |
| `value` | yes | Quantized integer (finite) |
| `sense` | yes | `MINIMIZE` or `MAXIMIZE` |

### OptimizationScore

| Field | Required | Notes |
|-------|----------|-------|
| `feasible` | yes | Mirror of feasibility gate |
| `hardViolationCount` | yes | Never compensated by soft scores |
| `authorityValues` | yes | Array aligned to policy.authorityKeys |
| `objectiveValues` | yes | Array aligned to policy.objectiveKeys |
| `displayTotal` | no | Display-only; **must not** control ranking |
| `comparatorVersion` | yes | Bound comparator version |
| `candidateId` | yes | Final tie-break key |

### OptimizationResult

| Field | Required | Notes |
|-------|----------|-------|
| `status` | yes | Optimization status enum |
| `requestId` | yes | Echo |
| `selectedCandidateId` | conditional | Present on success with feasible candidate |
| `rankedCandidateIds` | yes | Deterministic order |
| `failure` | conditional | `OptimizationFailure` when not success |
| `diagnostics` | yes | `SolverDiagnostics` |
| `replayMetadata` | yes | `ReplayMetadata` |
| `resultFingerprint` | yes | Stable fingerprint of rankable result material |

Partial success with **zero** feasible candidates must not be reported as normal success (`INFEASIBLE`).

### OptimizationFailure

| Field | Required | Notes |
|-------|----------|-------|
| `code` | yes | Failure code enum |
| `message` | yes | Human-readable |
| `details` | no | Canonical plain object |

### SolverDiagnostics

Serializable diagnostic shape for validation failures, candidate counts, feasible/infeasible counts, pruned counts, deterministic budget usage, budget exhaustion, watchdog timeout, comparator/fingerprint versions.

Wall-clock duration and machine identity may appear **only** in non-replay diagnostics and never in rankable / replay fingerprints.

### ReplayMetadata

Required:

- `engineVersion`
- `contractSchemaVersion`
- `policyId` / `policyVersion`
- `comparatorVersion`
- `fingerprintAlgorithmVersion`
- `inputSnapshotFingerprints`
- `seed` / `prngVersion` when applicable
- `operationId`
- `deterministicBudget`
- `resultFingerprint`

Excluded from replay-determining material:

- wall-clock duration
- machine identity
- current timestamp
- process ID
- memory usage
- runtime timing values

---

## Validation expectations

1. Required fields present and typed.
2. Strict schemas reject unknown fields.
3. `tenantId` and `competitionId` required and consistent across request/context.
4. Snapshot refs versioned and fingerprinted.
5. Stable IDs required (non-empty strings).
6. Replay-certified inputs reject non-canonical values.
7. Caller-owned inputs are never mutated; factories clone then freeze owned representations.
8. Unknown enum / strategy / operation values fail closed.
