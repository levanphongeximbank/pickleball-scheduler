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

---

## Phase 1C-A — Objective contracts

Capability-local only (`optimizer/`). Sibling to Phase 1B `ObjectiveEvaluation` — that contract is unchanged.

### ObjectiveDefinition

| Field | Required | Notes |
|-------|----------|-------|
| `objectiveId` | yes | Stable ID |
| `objectiveVersion` | yes | Version string |
| `direction` | yes | `MINIMIZE` or `MAXIMIZE` |
| `evaluatorRef` | yes | Stable evaluator descriptor ref (not a function) |
| `requiredContextRefs` | no | Stable IDs; duplicates rejected; stored sorted |
| `normalizationPolicy` | no | Phase 1C-A: `NONE` only (default) |
| `metadataCodes` | no | Stable codes; duplicates rejected; stored sorted |

Forbidden on definition: `order`, `weight`, `enabled`, `failurePolicy`, evaluator function, `displayTotal`, candidate/Schedule/Court/Referee fields.

### ObjectiveExecutionSpec

| Field | Required | Notes |
|-------|----------|-------|
| `objectiveId` | yes | Must resolve in registry |
| `objectiveVersion` | yes | Must resolve in registry |
| `weight` | yes | Positive safe integer |
| `quantizeScale` | yes | Positive safe integer |

Execution order is the **array order** of specs passed to `evaluateObjectives`. There is no numeric `order` field. `OptimizationPolicy` is not modified in Phase 1C-A.

### ObjectiveEvaluationRecord

Replay-safe record produced by `evaluateObjective` / `evaluateObjectives`:

| Field | Notes |
|-------|-------|
| `objectiveId` / `objectiveVersion` / `evaluatorRef` / `direction` | From definition |
| `executionIndex` | Non-negative safe integer (position in executionSpecs) |
| `rawValue` / `normalizedValue` | Finite numbers (`-0` → `+0`) |
| `quantizedValue` / `weightedValue` / `orientedValue` | Safe integers |
| `noteCodes` | Stable strings; duplicates rejected; stored sorted |

No free-text display message on the replay-safe record.

### Required context (`evaluationInput.contexts`)

When `requiredContextRefs` is non-empty:

- `evaluationInput.contexts` must be a plain object;
- each required ref must be an **own property**;
- own property with value `undefined` ⇒ missing;
- prototype-chain properties do **not** satisfy required context.

### Public Phase 1C-A API (capability-local)

`createObjectiveDefinition`, `OBJECTIVE_NORMALIZATION_POLICY`, `createObjectiveExecutionSpec`, `createObjectiveEvaluationRecord`, `createObjectiveRegistry`, `evaluateObjective`, `evaluateObjectives`, `OBJECTIVE_EVALUATION_FAILURE_CODE`, objective version constants.

Schema / registry / evaluation version constants:

- `CORE10_OBJECTIVE_DEFINITION_SCHEMA_VERSION`
- `CORE10_OBJECTIVE_REGISTRY_VERSION`
- `CORE10_OBJECTIVE_EVALUATION_VERSION`

---

## Phase 1C-B1 — Candidate evaluation contracts

Capability-local only (`optimizer/`). Does not modify Phase 1B `CandidateSolution`, `ConstraintEvaluation`, or Phase 1C-A objective files.

### CandidateEvaluationInput (replay-safe)

| Field | Required | Notes |
|-------|----------|-------|
| `schemaVersion` | yes | `CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_V1` |
| `evaluationVersion` | yes | Bound to `CORE10_HARD_VIOLATION_COMPOSITION_V1` in Phase 1C-B1 |
| `request` | yes | Owned `OptimizationRequest` clone |
| `context` | yes | Owned `OptimizationContext`; tenant/competition must match request |
| `candidate` | yes | `{ candidateId, operation, assignments }` — not `CandidateSolution` |
| `decisionVariables` | yes | Must match `request.decisionVariables` |
| `objectiveExecutionSpecs` | yes | Copied in caller order (never auto-sorted) |
| `authorityValues` | yes | Safe integers; length equals `policy.authorityKeys` |

Assignment records: `{ variableId, valueId }` (stable strings). Array order does not determine identity — owned representation is sorted by `variableId`. Duplicate `variableId` rejected. **Every** declared decision variable must receive exactly one assignment. `valueId` must be a **string domain member**. Own-property reads only.

### CandidateEvaluationDependencies (runtime-only)

| Field | Notes |
|-------|-------|
| `objectiveRegistry` | Phase 1C-A registry API |
| `constraintEvaluationPort` | Required — no `allowMissingPort` |
| `dependenciesVersion` | `CORE10_CANDIDATE_EVALUATION_DEPENDENCIES_V1` |

Not fingerprinted. No default registry/port. No module-level singleton.

### HardViolation (replay-safe sibling)

| Field | Notes |
|-------|-------|
| `violationCode` / `constraintId` / `sourceModule` / `sourceVersion` / `messageCode` | Stable non-empty strings |
| `severity` | Exactly `HARD` |
| `affectedIds` | Stable strings; duplicates rejected; stored sorted |
| `magnitude` | Non-negative safe integer |
| `detailsCodes` | Stable strings; duplicates rejected; stored sorted |

No free-text message. Phase 1B `ConstraintEvaluation` unchanged.

### ConstraintEvaluationPort

`{ portId, portVersion, evaluateConstraints(input) → { violations, noteCodes? } }`

Synchronous only. Promise/thenable rejected before result parsing. `violations` required (array; may be empty). Exceptions map to `CONSTRAINT_PORT_EXCEPTION` without leaking message/stack. Raw evaluator stays in a closure. Operations without business constraints must receive an **explicit** versioned no-op port created at the call site (e.g. `portId: CORE10_NOOP_CONSTRAINT_PORT`) — never a global singleton or exported fixture; never optional.

`validateCandidateEvaluationInput` failure shape: `{ ok:false, code, messageCode, details }` — stable codes only; no free-text ranking material.

### Public Phase 1C-B1 API (capability-local)

`CANDIDATE_EVALUATION_STATUS`, `CANDIDATE_EVALUATION_FAILURE_CODE`, `createCandidateEvaluationInput`, `createCandidateEvaluationDependencies`, `createHardViolation`, `createConstraintEvaluationPort`, `validateCandidateEvaluationInput`, `composeHardViolations`, and Phase 1C-B1 version constants.

Not exported in Phase 1C-B1: `evaluateCandidateSolution`, `CandidateEvaluationResult`, score composer, candidate search/solvers.

---

## Phase 1C-B2-A — Candidate result / failure / score / input fingerprint

Capability-local only (`optimizer/`). Does not implement `evaluateCandidateSolution` (Phase 1C-B2-B). Does not certify final result fingerprints (Phase 1C-C).

### CandidateEvaluationFailure (replay-safe)

| Field | Notes |
|-------|--------|
| `code` / `messageCode` | Stable Phase 1C-B failure codes (B1 + additive B2) |
| `stage` | `INPUT_VALIDATION` \| `DEPENDENCY_VALIDATION` \| `CONSTRAINT_PORT` \| `HARD_COMPOSITION` \| `OBJECTIVE_EVALUATION` \| `SCORE_COMPOSITION` \| `RESULT_CONSTRUCTION` \| `UNEXPECTED_FAILURE` |
| `detailsCodes` | Stable strings; duplicates rejected; stored sorted |
| `objectiveFailureCode` | Phase 1C-A code or `null` |
| `candidateId` | Stable string or `null` |
| `portDescriptor` | `{ portId, portVersion }` or `null` |
| `schemaVersion` | `CORE10_CANDIDATE_EVALUATION_FAILURE_SCHEMA_V1` |

No free-text `message`, stack, Error, raw exception, or function identity. Code/stage combinations are fail-closed.

Additive B2 codes: `OBJECTIVE_EVALUATION_FAILED`, `SCORE_COMPOSITION_FAILED`, `CANDIDATE_EVALUATION_UNEXPECTED_FAILURE`, `INVALID_CANDIDATE_EVALUATION_FAILURE`, `INVALID_CANDIDATE_EVALUATION_RESULT`, `INVALID_CANDIDATE_INPUT_FINGERPRINT`. Never mapped to `VALID_INFEASIBLE`.

### CandidateEvaluationResult

| Field | Notes |
|-------|--------|
| `status` | `VALID_FEASIBLE` \| `VALID_INFEASIBLE` \| `INVALID_CANDIDATE` \| `EVALUATION_FAILED` |
| `feasible` | Boolean aligned to status |
| `structuralViolations` | Always `[]` in Phase 1C-B2 |
| `businessViolations` / `allHardViolations` | HardViolation arrays; equal on `VALID_INFEASIBLE` |
| `objectiveEvaluations` | `ObjectiveEvaluationRecord[]` or `[]` |
| `optimizationScore` | Present on feasible/infeasible; `null` on invalid/failed |
| `failure` | Required on invalid/failed; `null` otherwise |
| `portDescriptor` / `inputFingerprint` | Required on valid statuses; null on `INVALID_CANDIDATE` |
| `evaluationVersion` | `CORE10_CANDIDATE_EVALUATION_PIPELINE_V1` |
| `schemaVersion` | `CORE10_CANDIDATE_EVALUATION_RESULT_SCHEMA_V1` |

Failure-path purity: invalid/failed results carry empty violations, empty objectives, and `optimizationScore=null`.

### composeCandidateOptimizationScore

Calls `createOptimizationScore` directly (never `buildOptimizationScore`). Feasible: `hardViolationCount=0`, `objectiveValues` from `orientedValue` order. Infeasible: positive `hardViolationCount`, empty objectives, authority retained.

### Input fingerprint (internal)

`createCandidateEvaluationInputFingerprint` is evaluation-local (available via `evaluation/index.js` for B2-B). **Not** exported from `optimizer/index.js`. Binds versions, request/context/candidate material, specs order, registry descriptor fingerprint, port id/version, authority values, comparator version. Excludes evaluator/port functions and runtime identity. Final result fingerprint remains Phase 1C-C.

### Public Phase 1C-B2-A API (capability-local)

`createCandidateEvaluationFailure`, `createCandidateEvaluationResult`, `composeCandidateOptimizationScore`, and Phase 1C-B2-A version constants.

Not exported in Phase 1C-B2-A: failure-stage helper from `optimizer/index.js`, input fingerprint from `optimizer/index.js`, solvers.

---

## Phase 1C-B2-B — Candidate evaluation orchestration

Capability-local only (`optimizer/`). Implements `evaluateCandidateSolution(rawInput, rawDependencies)`. Does not certify final result fingerprints (Phase 1C-C). Does not own CORE-01 `evaluateCandidate`.

### Pipeline (exact order)

1. `validateCandidateEvaluationInput`
2. `createCandidateEvaluationDependencies`
3. Copy certified `{ portId, portVersion }`
4. `createCandidateEvaluationInputFingerprint` (before port)
5. Build owned `ConstraintPortInput` (`facts: {}`; snapshot fingerprints preserve `context.snapshotRefs` order)
6. Invoke constraint port exactly once
7. `composeHardViolations` exactly once
8. Hard-feasibility gate (`composed.length > 0` ⇒ infeasible; skip objectives)
9. Feasible-only `evaluateObjectives` with owned `{ candidate, requestId, tenantId, competitionId, authorityValues, contexts: {} }`
10. `composeCandidateOptimizationScore`
11. `createCandidateEvaluationResult`

Port / objective / composition failures map to `EVALUATION_FAILED` (never `VALID_INFEASIBLE`). Result-envelope construction failures throw `OptimizerContractError` (no recursive wrap).

### Public Phase 1C-B2-B API (capability-local)

`evaluateCandidateSolution` in addition to Phase 1C-B2-A exports.

Not exported: input fingerprint helper, failure-stage enum, port-input builders, failure mappers, result helpers, solvers.

---

## Phase 1C-C — CandidateEvaluationResult fingerprint

Capability-local only (`optimizer/`). Certifies replay-equivalent result-content identity. Does **not** modify `CandidateEvaluationResult` schema and does **not** attach a fingerprint inside `evaluateCandidateSolution`.

### API

```text
createCandidateEvaluationResultFingerprint(result) → string
```

- Revalidates through `createCandidateEvaluationResult` (owned clone; caller never mutated/frozen).
- Hashes approved envelope material via CORE-10 `fingerprintValue`.
- Material binds `CORE10_CANDIDATE_RESULT_FINGERPRINT_V1` plus the full public result envelope.
- Preserves objective / authority / objective-value order; does not re-sort material arrays.
- Throw-only code: `INVALID_CANDIDATE_EVALUATION_RESULT_FINGERPRINT_INPUT` (cannot be stored in `CandidateEvaluationFailure`).

### Public Phase 1C-C API (capability-local)

`createCandidateEvaluationResultFingerprint`, `CORE10_CANDIDATE_RESULT_FINGERPRINT_VERSION`.

Not exported: material builders, serializers, validators, hash internals. Root `competition-core/index.js` unchanged. Input fingerprint remains non-public.

---

## Phase 1D — Candidate ranking / feasible-winner selection

Capability-local only (`optimizer/`). Ranks a supplied frontier of already evaluated candidates. Does not generate candidates, search, project `OptimizationResult`, or attach fingerprints.

### API

```text
rankCandidateEvaluations(frontier) → frozen ranking view
```

- Revalidates each item through `createCandidateEvaluationResult`.
- Accepts only `VALID_FEASIBLE` / `VALID_INFEASIBLE`.
- Reuses `sortScoresDeterministic` (`CORE10_COMPARATOR_V1`).
- Returns `{ rankedCandidateIds, selectedCandidateId, rankedScores, feasibleCount, infeasibleCount, rankingVersion }`.
- Empty frontier and all-infeasible frontiers yield `selectedCandidateId=null`; infeasible IDs remain ranked.
- Throw-only codes: `INVALID_CANDIDATE_RANKING_INPUT`, `DUPLICATE_CANDIDATE_ID`.

### Public Phase 1D API (capability-local)

`rankCandidateEvaluations`, `CANDIDATE_RANKING_FAILURE_CODE`, `CORE10_CANDIDATE_RANKING_VERSION`.

See `05_CANDIDATE_RANKING.md`. Root `competition-core/index.js` unchanged.