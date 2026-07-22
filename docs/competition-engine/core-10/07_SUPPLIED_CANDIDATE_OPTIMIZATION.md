# CORE-10 — Supplied-Candidate Optimization Orchestration (Phase 1F)

**Module:** `src/features/competition-core/optimizer/orchestration/`
**Version:** `CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V1` (historical Phase 1F); active orchestration fingerprint uses Phase 1G `CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2`
**Capability:** supplied-input optimizer (not a production global search solver)

---

## Purpose

Phase 1F orchestrates evaluation of a **caller-supplied** unevaluated candidate batch, then reuses Phase 1D ranking and existing `OptimizationResult` factories to return a frozen result.

It is a **supplied-input optimizer** under `CONTRACT_ONLY`. It does **not** generate candidates, search, run greedy/exhaustive solvers, consume wall-clock budgets, or claim solver-node activity.

Phase 1G extends the same API with deterministic evaluation-budget termination for `maxCandidates` / `maxEvaluations`. See `08_SUPPLIED_CANDIDATE_BUDGET_TERMINATION.md`.

---

## Ownership

Phase 1F owns:

- synchronous `optimizeSuppliedCandidates(optimizationRequest, suppliedCandidateBatch, evaluationDependencies)`;
- request / strategy / operation admission for this capability;
- supplied-batch admission (fail closed);
- deterministic canonical evaluation order by `candidateId`;
- honest evaluation accounting in diagnostics;
- capability-local tests and documentation.

Phase 1F does **not** own:

- candidate generation / search / `DETERMINISTIC_GREEDY` / `EXHAUSTIVE`;
- changes to `CandidateEvaluationResult`, ranking contracts, or Phase 1E zero-budget projection semantics;
- new `OptimizationResult` schema fields;
- wall-clock watchdog termination;
- CORE-01 adapters, Schedule / Court / Referee, persistence, UI;
- root `competition-core/index.js` export.

Evaluation-budget termination for supplied candidates (`BUDGET_EXHAUSTED` on truncated batches) is owned by Phase 1G.

---

## Public API

```text
optimizeSuppliedCandidates(
  optimizationRequest,
  suppliedCandidateBatch,
  evaluationDependencies
) → frozen OptimizationResult
```

Exported only through `src/features/competition-core/optimizer/index.js`.

Not exported through `src/features/competition-core/index.js`.

Synchronous only. Promise/thenable values for any of the three arguments are rejected (`INVALID_REQUEST`). Nothing is awaited.

### Request admission

Reuse `validateOptimizationRequest` (fail closed / throw).

Accepted:

- `operation.operationId === GENERIC_CANDIDATE_RANKING`
- `strategy === CONTRACT_ONLY`

Wrong operation ⇒ `INVALID_OPERATION`. Wrong strategy ⇒ `UNSUPPORTED_STRATEGY`.

---

## Supplied candidate batch contract

Exact admitted shape:

```text
{
  candidates: [
    {
      candidateId: string,          // stable ID
      assignments: [                // existing evaluation assignment shape
        { variableId, valueId }
      ]
    }
  ],
  decisionVariables: [...],         // existing DecisionVariable factory shape
  objectiveExecutionSpecs: [...],   // existing ObjectiveExecutionSpec factory shape
  authorityValues: number[],        // required; length must equal policy.authorityKeys
  context?: OptimizationContext     // optional; defaults to request.context
}
```

Rules:

- fail closed on non-object / unknown fields;
- `candidates` must be an array (may be empty);
- duplicate `candidateId` ⇒ `DUPLICATE_CANDIDATE_ID`;
- each candidate admits only `candidateId` + `assignments` (operation is injected from the request when building `CandidateEvaluationInput`);
- `authorityValues` is required because existing `createCandidateEvaluationInput` requires an array;
- `context` defaults to a non-mutating copy of `optimizationRequest.context` when omitted;
- caller-owned inputs are never mutated.

Each admitted candidate is turned into a `CandidateEvaluationInput` via existing factories before `evaluateCandidateSolution`.

---

## Pipeline

1. Reject Promise/thenable args.
2. Validate request; enforce accepted operation + strategy.
3. Admit supplied batch (fail closed).
4. Canonicalize evaluation order by `candidateId` using `compareStableString` (UTF-16 code units; not `localeCompare`; not caller array order).
5. Derive effective evaluation limit (Phase 1G) and select the evaluated prefix.
6. Certify `evaluationDependencies` via `createCandidateEvaluationDependencies`.
7. For each selected canonical candidate: build `CandidateEvaluationInput` → `evaluateCandidateSolution` (count one evaluation per invocation).
8. Non-rankable evaluation statuses (`INVALID_CANDIDATE`, `EVALUATION_FAILED`, …) fail closed (throw). They are never dropped and never converted to `INFEASIBLE`.
9. `rankCandidateEvaluations(evaluatedFrontier)` (Phase 1D) over the **evaluated subset only**.
10. Build diagnostics / replay / fingerprint / `OptimizationResult` via existing factories with **honest** evaluation counts.

Phase 1F does **not** call Phase 1E projection unchanged, because Phase 1E always reports `budgetUsage.evaluations = 0`. Phase 1F builds the result directly with the same factories so evaluation accounting remains honest. Phase 1E public behavior is unchanged.

Full-batch ranking applies only when the admitted batch is within the effective evaluation budget (or unlimited). Truncated results are partial and use `BUDGET_EXHAUSTED` (Phase 1G).

---

## Empty and infeasible behaviour

| Condition | `status` | `selectedCandidateId` | evaluations |
|-----------|----------|------------------------|-------------|
| Empty `candidates` | `INFEASIBLE` | `null` | `0` |
| Complete evaluation, all rankable but infeasible | `INFEASIBLE` | `null` | `N` |
| Complete evaluation, at least one feasible | `SUCCESS` | Phase 1D winner | `N` |
| Truncated non-empty batch (Phase 1G) | `BUDGET_EXHAUSTED` | best evaluated-so-far or `null` | limit |

Contract/input failures throw and do **not** return an `INFEASIBLE` domain result.

Empty batch takes precedence over budget exhaustion.

`rankedCandidateIds` mirrors Phase 1D over the evaluated subset (infeasible IDs retained after feasible).

---

## Diagnostics semantics

| Field | Value |
|-------|-------|
| `candidateCount` | admitted supplied candidate count |
| `feasibleCount` / `infeasibleCount` | from Phase 1D ranking of evaluated subset |
| `budgetUsage.nodes` | `0` |
| `budgetUsage.candidates` | admitted supplied candidate count |
| `budgetUsage.evaluations` | actual `evaluateCandidateSolution` invocations |
| `prunedCount` | `0` |
| `budgetExhausted` | `false` when complete; `true` when Phase 1G truncates a non-empty batch |
| `watchdogTimeout` | `false` |

No solver nodes, search tree, generated candidates, watchdog, or wall-clock timing.

---

## Budget policy

Phase 1F originally deferred runtime budget exhaustion. **Phase 1G supersedes that deferral** for `maxCandidates` / `maxEvaluations` on the supplied-candidate path:

- effective limit = min of non-null `maxCandidates` / `maxEvaluations`;
- both null ⇒ no evaluation cap (including only-`maxNodes` budgets);
- `maxNodes` does not limit supplied-candidate evaluations;
- zero is a real limit;
- truncated batches return `BUDGET_EXHAUSTED` (never `SUCCESS`).

Wall-clock watchdog semantics remain out of scope.

See `08_SUPPLIED_CANDIDATE_BUDGET_TERMINATION.md`.

---

## Replay and fingerprint

Replay metadata reuses `createReplayMetadata` (engine/schema/policy/comparator/fingerprint versions, snapshot fingerprints, seed/PRNG only when seed present, operation, deterministic budget, result fingerprint). No timestamps / `Date.now`.

Active result fingerprint material (via `fingerprintValue`) binds at least:

- `CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2`
- `requestId`, `status`, `failureCode`
- `selectedCandidateId`, `rankedCandidateIds`
- `candidateCount`, feasible/infeasible counts, `evaluationCount`, `budgetExhausted`

Historical constant `CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION` remains `…_V1` for compatibility.

Same logical input under different caller candidate order ⇒ same fingerprint. Different `requestId`, winner, or complete-vs-exhausted semantics ⇒ different fingerprint.

---

## Determinism

1. Canonical evaluation order by `candidateId` (`compareStableString`).
2. Ranking delegates entirely to Phase 1D (`CORE10_COMPARATOR_V1`).
3. No `Math.random`, `Date.now`, `localeCompare`, filesystem, network, or sibling CORE imports.
4. Caller inputs never mutated / frozen in place.
5. Returned `OptimizationResult` frozen per existing factory contract.
6. Phase 1G stopping point is deterministic from discrete budgets + canonical order (not wall-clock).

---

## Explicit non-claims

- Not a production global solver.
- No candidate generation.
- No search / greedy / exhaustive / recursive search.
- No sibling CORE module imports.
- Root barrel unchanged.
- Future search strategies (`DETERMINISTIC_GREEDY`, `EXHAUSTIVE`) remain out of scope and unsupported here.
- Wall-clock watchdog is out of scope.

---

## Public exports (capability-local)

`optimizeSuppliedCandidates`, `CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION` (V1), `CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2`.

Not exported: fingerprint material builder helpers. Root barrel unchanged.
