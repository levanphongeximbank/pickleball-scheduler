# CORE-10 — Determinism Policy

**Policy id:** `CORE10_DETERMINISM_V1`
**Helpers (capability-local):** `optimizer/deterministic/`
**Ownership:** CORE-10-local implementation. Do not deep-import private fingerprint/PRNG helpers from other COREs.

---

## Hard rules

1. **No `Math.random`** — ambient randomness is forbidden. Missing/invalid seed fails closed.
2. **No `Date.now` / current time / execution timing** in ranking, score comparison, or replay fingerprints.
3. **No `localeCompare`** and no locale-sensitive sorting for deterministic ordering.
4. **No floating-point equality** for ranking — use quantized integers.
5. **No unstable object-key iteration** — canonicalize by sorting keys with the stable string comparator before serialization.
6. **Wall-clock timeout** may exist only as a **safety watchdog**. A timeout-triggered run must **not** be reported as replay-certified success (`WATCHDOG_TIMEOUT`).

---

## Canonical serialization

Algorithm id: `CORE10_CANONICAL_JSON_V1`

1. Validate values are JSON-canonical (no functions, Date, Map, Set, undefined, symbol, bigint, NaN, Infinity, cycles).
2. Sort object keys by **explicit stable string comparator** (UTF-16 code-unit / canonical byte ordering of the key string).
3. Preserve array order unless a contract explicitly requires canonical sorting of that array.
4. Serialize with `JSON.stringify` over the canonicalized structure.
5. Same accepted input ⇒ identical serialized form.

### Number / string policy details

| Topic | Policy |
|-------|--------|
| `-0` | Normalized to `+0` before serialization (matches `JSON.stringify` collapse). |
| Surrogate pairs | Compared and hashed as UTF-16 code units (`charCodeAt`); no special pairing rewrite. |
| Unicode normalization | **No** NFC/NFD rewrite — strings are taken as provided code-unit sequences. |
| Object property ordering | Sorted by stable string comparator; insertion order must not affect output. |
| Array ordering | Preserved as contractual order. |
| Integer boundaries | Replay numbers must be finite; ranking scores must be finite integers (`Number.isInteger`). Prefer string seeds for values outside safe integer identity concerns. |

---

## Fingerprint

| Property | Value |
|----------|-------|
| Algorithm | FNV-1a 32-bit over canonical serialization |
| Version constant | `CORE10_FINGERPRINT_V1` |
| Output | 8-char lowercase hex (unsigned 32-bit) |
| Claim | Deterministic identity / replay checks — **not** cryptographic security |

Fingerprint material always includes `fingerprintAlgorithmVersion`.
Same accepted input ⇒ same fingerprint.
Contractually material differences ⇒ different fingerprints (covered by tests).
`resultFingerprint` material must **not** recursively include the `resultFingerprint` field itself.

---

## Seeded random policy

| Property | Value |
|----------|-------|
| Algorithm | Mulberry32 |
| Version | `CORE10_PRNG_MULBERRY32_V1` |
| Seed | Explicit required non-empty string **or** finite integer (including `0` and negatives); normalized to string then hashed with PRNG version |
| Fallback | **None** — never host ambient RNG |

Same seed + same call sequence ⇒ identical values.
Empty string, `null`, `undefined`, non-integer numbers, and non-string/non-integer types fail closed.
Phase 1B does **not** use the PRNG to generate domain candidates.

---

## Comparator version

Constant: `CORE10_COMPARATOR_V1`

Required comparison order for candidates / scores:

1. Feasible candidates before infeasible candidates.
2. Hard-constraint violations are never compensated by soft scores (`hardViolationCount` ascending; infeasible with more hard violations ranks worse).
3. Structured authority / priority keys when supplied (policy order).
4. Objective keys in declared policy order (respecting `MINIMIZE` / `MAXIMIZE` via stored oriented values).
5. Stable `candidateId` as the **final** tie-break (stable string comparator).

`displayTotal` is display-only and **must not** control ranking.

---

## Integer / quantized scoring

- Objective and violation magnitudes are quantized integers.
- Policy `quantizeScale` is a positive integer documenting the quantization grid.
- Ranking uses integer comparison only.

---

## Stable string / ID comparator

Function: `compareStableString(a, b)`

- Compares UTF-16 code units sequentially (same as canonical byte ordering of the UTF-16 code-unit sequence for BMP-oriented IDs).
- Shorter common-prefix string sorts first when all shared units are equal.
- **Does not** call `localeCompare`.
- Used for: object key sorting, candidate ID tie-break, stable ID ordering.

---

## Deterministic search budgets

Replay-certified budgets use discrete counters such as:

- `maxNodes`
- `maxCandidates`
- `maxEvaluations`

Budget exhaustion ⇒ `BUDGET_EXHAUSTED` (not replay-certified success).
Watchdog wall-clock timeout ⇒ `WATCHDOG_TIMEOUT` (not replay-certified success).

---

## Replay requirements

`ReplayMetadata` must bind:

- engine version
- contract schema version
- policy id + version
- comparator version
- fingerprint algorithm version
- input snapshot fingerprints
- seed + PRNG version when applicable
- operation identifier
- deterministic budget
- result fingerprint

Exclude from replay-determining fingerprints: wall-clock duration, machine identity, timestamps, PID, memory, runtime timing.

---

## Phase 1C-A — Objective evaluation determinism

1. Objective evaluators are **synchronous only**. Promise/thenable results fail with `ASYNC_OBJECTIVE_EVALUATOR_UNSUPPORTED` (checked before result schema validation).
2. Execution order is exactly the caller-supplied `executionSpecs` array order — registry insertion order must not affect evaluation order.
3. Registry uses nested `Map(objectiveId → Map(objectiveVersion → entry))` — no delimiter-joined keys.
4. `descriptorFingerprint()` binds `CORE10_OBJECTIVE_DEFINITION_SCHEMA_VERSION`, `CORE10_OBJECTIVE_REGISTRY_VERSION`, and sorted definitions. Evaluator function source is never fingerprinted.
5. Quantization: `Math.round(normalizedValue * quantizeScale)` → safe integer; `-0` → `+0` after each numeric stage.
6. Weighting: `quantizedValue * weight` with safe-integer overflow checks.
7. Orientation reuses Phase 1B `orientObjectiveValue` (`MINIMIZE` keep, `MAXIMIZE` negate).
8. No `Math.random`, wall-clock, locale sorting, or floating-point equality for ranking keys.
9. Evaluator exceptions become `OBJECTIVE_EVALUATOR_EXCEPTION` without leaking message/stack into replay-safe records.
10. Empty `executionSpecs` returns an empty frozen array and invokes no evaluator.
11. Failures throw immediately — no partial-success envelope in Phase 1C-A.
12. Caller objects/arrays are never frozen or sorted in place; factories/evaluators operate on owned clones.

---

## Phase 1C-B1 — Candidate evaluation determinism

1. Constraint ports are **synchronous only**. Promise/thenable results fail with `ASYNC_CONSTRAINT_PORT_UNSUPPORTED`.
2. Candidate assignment arrays are copied; owned canonical order is by stable `variableId`. Caller arrays are never sorted in place.
3. Hard-violation composition uses canonical serialized identity tuples (no delimiter-joined keys) over `sourceModule`, `sourceVersion`, `violationCode`, `constraintId`, `affectedIds`.
4. Composition order is stable by sourceModule → sourceVersion → violationCode → constraintId → affectedIds tuple → magnitude → messageCode → detailsCodes tuple.
5. Exact duplicate hard violations are deduplicated; magnitude conflicts fail closed (`HARD_VIOLATION_MAGNITUDE_CONFLICT`); messageCode/detailsCodes conflicts fail closed (`DUPLICATE_HARD_VIOLATION`).
6. Runtime dependencies (registry evaluators, port functions) are never included in replay-safe fingerprints.
7. Structural candidate-input failures produce Phase 1C-B failure codes — not HardViolation objects and not run-level `INFEASIBLE`.
8. No `Math.random`, wall-clock, locale sorting, or floating-point ranking keys in Phase 1C-B1 contracts.

---

## Phase 1C-B2-A — Result / failure / score / input fingerprint determinism

1. `CandidateEvaluationFailure` and `CandidateEvaluationResult` are immutable owned values; caller objects/arrays are never frozen or sorted in place.
2. Failure `detailsCodes` are copy-sorted; duplicates fail closed.
3. `composeCandidateOptimizationScore` never injects sentinel objective values and never calls `buildOptimizationScore`.
4. Candidate input fingerprint uses CORE-10 `fingerprintValue` over canonical material only — no evaluator/port functions, timestamps, random, or localeCompare.
5. Assignment order does not affect the fingerprint (assignments re-ordered by `variableId` in fingerprint material, matching CandidateEvaluationInput canonicalization). `objectiveExecutionSpecs` order and `authorityValues` order do affect it. Registry insertion order does not (descriptor fingerprint). Snapshot refs preserve `OptimizationContext.snapshotRefs` insertion order (no second sort by `snapshotId`).
6. `structuralViolations` remain empty throughout Phase 1C-B2; business and all-hard arrays are deeply equivalent on `VALID_INFEASIBLE`.
7. Failure-path purity: `INVALID_CANDIDATE` / `EVALUATION_FAILED` never retain partial violations, objectives, or scores. `EVALUATION_FAILED` at `DEPENDENCY_VALIDATION` requires `portDescriptor=null` and `inputFingerprint=null`.
8. `INVALID_CANDIDATE_EVALUATION_FAILURE` is reserved for contract-validation throws and cannot be stored as a pipeline failure code.
9. Final `CandidateEvaluationResult` fingerprint certification remains Phase 1C-C.

---

## Phase 1C-B2-B — Orchestration determinism

1. `evaluateCandidateSolution` is synchronous only — no Promise, async, concurrency, retry, or timers.
2. Input fingerprint is computed after dependency certification and **before** constraint-port invocation.
3. Constraint port is invoked at most once per call; never for invalid input or failed dependency certification; never after fingerprint failure.
4. Objectives are invoked only when composed hard violations are empty; execution-spec order is preserved; empty specs yield `VALID_FEASIBLE` with empty objective records.
5. Owned port input uses `facts: {}` and preserves `OptimizationContext.snapshotRefs` fingerprint order (no second sort).
6. Caller `rawInput` / `rawDependencies` are never mutated or frozen in place.
7. No `Date.now`, `new Date`, `Math.random`, `localeCompare`, environment variables, object-identity fingerprinting, or function-source fingerprinting.
8. Repeated equivalent evaluations produce deeply equivalent results and identical `inputFingerprint` values.
