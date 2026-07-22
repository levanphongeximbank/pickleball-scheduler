# CORE-10 — Supplied-Frontier OptimizationResult Projection (Phase 1E)

**Module:** `src/features/competition-core/optimizer/projection/`
**Version:** `CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_V1`
**Ranking:** Phase 1D `rankCandidateEvaluations` (`CORE10_CANDIDATE_RANKING_V1`)

---

## Ownership

Phase 1E owns:

- synchronous `projectOptimizationResultFromEvaluatedFrontier(optimizationRequest, evaluatedFrontier)`;
- request / strategy / operation admission for this capability;
- projection of existing `OptimizationResult` via existing factories;
- capability-local projection tests and documentation.

Phase 1E does **not** own:

- candidate generation / search / `DETERMINISTIC_GREEDY` / `EXHAUSTIVE`;
- changes to `CandidateEvaluationResult`, evaluation fingerprints, or ranking contracts;
- new `OptimizationResult` schema fields;
- CORE-01 adapters, Schedule / Court / Referee, persistence, UI;
- root `competition-core/index.js` export.

---

## Public API

```text
projectOptimizationResultFromEvaluatedFrontier(optimizationRequest, evaluatedFrontier)
  → frozen OptimizationResult
```

### Inputs

| Arg | Rules |
|-----|--------|
| `optimizationRequest` | Validated via `validateOptimizationRequest`; Promise/thenable rejected |
| `evaluatedFrontier` | Array of `CandidateEvaluationResult` (Phase 1D admission); Promise/thenable rejected |

Accepted request admission:

- `operation.operationId === GENERIC_CANDIDATE_RANKING`
- `strategy === CONTRACT_ONLY`

Wrong operation ⇒ `INVALID_OPERATION`. Wrong strategy ⇒ `UNSUPPORTED_STRATEGY`.

### Pipeline

1. Reject Promise/thenable args.
2. Validate request (fail closed).
3. Enforce accepted operation + strategy.
4. `rankCandidateEvaluations(evaluatedFrontier)`.
5. Project status / selected / ranked IDs.
6. Build diagnostics + replay metadata + result fingerprint via existing factories.
7. Return `createOptimizationResult(...)`.

### OptimizationResult behaviour

| Condition | `status` | `selectedCandidateId` | `failure` |
|-----------|----------|------------------------|-----------|
| Empty frontier | `INFEASIBLE` | `null` | `INFEASIBLE` |
| All infeasible | `INFEASIBLE` | `null` | `INFEASIBLE` |
| Feasible winner exists | `SUCCESS` | ranked feasible winner | `null` |

`rankedCandidateIds` always mirrors Phase 1D ranking (infeasible IDs retained after feasible).

### Diagnostics / replay

- Diagnostics: `createEmptySolverDiagnostics` with observational `candidateCount` / `feasibleCount` / `infeasibleCount` from the ranked frontier. `budgetUsage` remains `{ nodes: 0, candidates: 0, evaluations: 0 }` — Phase 1E does not search, evaluate, or consume deterministic budget. No budget exhaustion / watchdog.
- Replay: `createReplayMetadata` from request policy, seed, snapshots, operation, budget, and computed `resultFingerprint`.
- Fingerprint material binds `CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_V1` + rankable result fields (no recursive fingerprint).

---

## Determinism

1. Reuses Phase 1D ranking only — no new comparator.
2. No `Math.random`, `Date.now`, `localeCompare`, or environment ordering.
3. Caller inputs never mutated / frozen in place.
4. Output `OptimizationResult` (and nested factory values) frozen.

---

## Public exports (capability-local)

`projectOptimizationResultFromEvaluatedFrontier`, `CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_VERSION`.

Not exported: fingerprint material builder helpers. Root barrel unchanged.
