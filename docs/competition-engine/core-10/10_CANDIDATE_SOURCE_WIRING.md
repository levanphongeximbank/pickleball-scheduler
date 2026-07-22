# CORE-10 — Candidate Source Wiring (Phase 1I)

**Module:** `src/features/competition-core/optimizer/`
**Capability:** Source-backed optimization via existing supplied-candidate orchestration
**Result fingerprint version (unchanged):** `CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2`

---

## Phase objective

Wire an approved **Candidate Source Port** into the existing Phase 1F/1G orchestrator:

```text
optimizeCandidateSource(
  optimizationRequest,
  candidateSourcePort,
  evaluationDependencies,
  sourceContext?
)
  → validate arguments
  → verify Candidate Source Port (`isCandidateSourcePort`)
  → candidateSourcePort.produce(optimizationRequest, sourceContext)  // exactly once
  → optimizeSuppliedCandidates(
      optimizationRequest,
      producedCandidateBatch,
      evaluationDependencies
    )
  → return the same frozen OptimizationResult
```

Phase 1I is a **thin synchronous wiring layer only**. It does not generate candidates, search, own budgets, remaph fingerprints, or claim production Global Optimizer completion.

---

## Signature

```js
optimizeCandidateSource(
  optimizationRequest,
  candidateSourcePort,
  evaluationDependencies,
  sourceContext?
) → frozen OptimizationResult
```

- Synchronous only.
- Rejects Promise / thenable `optimizationRequest`, `candidateSourcePort`, `evaluationDependencies`, and `sourceContext`.
- Requires a valid Candidate Source Port (`isCandidateSourcePort`); duck-typed raw functions / batches / partial objects fail closed (`INVALID_REQUEST`).
- Does not overload `optimizeSuppliedCandidates`.

---

## Once-only source invocation

- `candidateSourcePort.produce` runs **exactly once** per `optimizeCandidateSource` call.
- Invocation happens **before** `optimizeSuppliedCandidates`.
- No retries, probing, preflight produce calls, or produce during type guards.
- Source output is not evaluated twice by Phase 1I (port validation + supplied admission double-check remains intentional).

---

## Source output validation

The Candidate Source Port already owns:

- source exception wrapping (ordinary `Error` → `INVALID_REQUEST`; preserve `OptimizerContractError`);
- Promise / thenable output rejection;
- output validation through `createCandidateBatch`.

Phase 1I relies on that contract and **still** passes the produced batch into `optimizeSuppliedCandidates`, which re-admits via its private admission logic. Double validation is acceptable and intentional. Do not bypass supplied admission.

---

## Delegation

Existing supplied-candidate orchestration remains the sole owner of:

- Candidate Batch re-admission;
- `request.context` fallback;
- canonicalization by `candidateId`;
- duplicate handling;
- `maxCandidates` / `maxEvaluations`;
- `maxNodes` supplied-path behavior (ignored);
- evaluation;
- ranking;
- result status;
- diagnostics;
- replay material;
- result fingerprint.

Phase 1I does **not** introduce a shared generic orchestrator helper and does **not** unify private supplied-batch admission with `createCandidateBatch`.

---

## Context precedence

Preserved through pure delegation (no merge, no pre-copy of `request.context` into the produced batch):

| Produced batch | Behavior |
|----------------|----------|
| Has own `context` property | `batch.context` wins; `request.context` does not override |
| Omits `context` | `optimizeSuppliedCandidates` applies `request.context` fallback |
| Explicit `null` / invalid `context` | Fail closed under existing Candidate Batch / supplied admission rules |

---

## Ordering and duplicates

Exact sequence:

1. Candidate Source Port produces a full validated batch.
2. Existing supplied orchestration re-admits the batch.
3. Duplicate `candidateId` values fail **before** truncation (`DUPLICATE_CANDIDATE_ID`).
4. Candidates are canonicalized by `candidateId`.
5. Budget truncation selects the canonical prefix.
6. Selected candidates are evaluated.
7. Evaluations are ranked.
8. Existing result fingerprint is created.

Source emission order must not affect the selected candidate subset. Structural duplicates with different candidate IDs remain distinct. Phase 1I does not sort or deduplicate.

---

## Budget non-ownership

Phase 1I does **not** inspect or decrement budgets.

Phase 1G semantics remain authoritative:

- `maxCandidates` enforced after `candidateId` canonicalization;
- `maxEvaluations` enforced by existing orchestration;
- effective limit = existing `min` behavior;
- `maxNodes` ignored on supplied / source-backed batch path;
- zero is a real limit;
- non-empty input with zero limit may return `BUDGET_EXHAUSTED`;
- empty batch retains existing `INFEASIBLE` precedence;
- source execution consumes no candidate / evaluation budget;
- source output is not truncated by the source;
- source failures never map to `BUDGET_EXHAUSTED`.

---

## Unchanged result fingerprint

Results continue to bind `CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2`.

Not bound into result fingerprint:

- `portId` / `portVersion`;
- function identity;
- `sourceContext` identity;
- timestamps / stack traces / process or host state;
- caller array order.

The same optimization request and equivalent Candidate Batch content must produce the same result identity whether supplied directly or through a Candidate Source Port.

No separate Phase 1I fingerprint version is introduced; a wrapper-only capability constant is optional and deliberately omitted to avoid version duplication.

---

## Error mapping

| Condition | Behavior |
|-----------|----------|
| Invalid Candidate Source Port | Throw `OptimizerContractError` (`INVALID_REQUEST`) |
| Source throws `OptimizerContractError` | Preserve and rethrow (no double-wrap) |
| Source throws ordinary `Error` | Port wraps as `INVALID_REQUEST` |
| Source returns Promise / thenable | Throw `INVALID_REQUEST` |
| Source returns invalid Candidate Batch | Existing contract error |
| Source returns duplicate candidate IDs | `DUPLICATE_CANDIDATE_ID` |
| Evaluation failure | Preserve `optimizeSuppliedCandidates` behavior |
| No candidates | Existing `INFEASIBLE` result |
| Non-empty batch with zero effective budget | Existing `BUDGET_EXHAUSTED` result |
| All evaluated candidates infeasible | Existing `INFEASIBLE` result |

Do not add new error codes. Do not convert contract errors into OptimizationResult envelopes.

---

## Capability-local export boundary

Exported only through:

- `src/features/competition-core/optimizer/orchestration/index.js`
- `src/features/competition-core/optimizer/index.js`

Root `src/features/competition-core/index.js` remains unchanged.

One new public operation only: `optimizeCandidateSource`.

No aliases such as `optimizeFromCandidateSource`, `runCandidateSourceOptimization`, `optimizeGeneratedCandidates`, `runOptimization`, or `optimizeCandidates`.

---

## Explicit exclusions

Phase 1I is **not**:

- candidate generation;
- deterministic greedy search;
- exhaustive search;
- search-node traversal / `maxNodes` execution;
- domain adapters;
- overload of `optimizeSuppliedCandidates`;
- shared generic orchestrator helper;
- async orchestration;
- production Global Optimizer completion.

---

## Later phases

Later phases may introduce generation strategies, search traversal, or domain adapters behind Candidate Source Port implementations. Phase 1I deliberately stops at source-to-existing-orchestrator wiring so that boundary can be reviewed independently.

---

## Public Phase 1I API (capability-local)

`optimizeCandidateSource`

See also: `07_SUPPLIED_CANDIDATE_OPTIMIZATION.md`, `08_SUPPLIED_CANDIDATE_BUDGET_TERMINATION.md`, `09_CANDIDATE_SOURCE_CONTRACT.md`.
