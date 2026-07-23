# CORE-10 — Deterministic Bounded Search (Phase 1L)

**Module:** `src/features/competition-core/optimizer/search/`
**Capability version:** `CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1`
**Strategy V1:** `CORE10_DETERMINISTIC_BOUNDED_SEARCH_STRATEGY_DFS_V1`
**Capability:** Deterministic bounded structural assignment-tree search with maxNodes ownership

---

## Purpose

Provide a **separate** deterministic bounded-search capability alongside Phase 1J:

| Capability | Role |
|------------|------|
| Phase 1J | Full Cartesian generator for small spaces |
| Phase 1L | Deterministic bounded DFS over the assignment tree with `maxNodes` |

Public architecture permits future versioned deterministic strategies without implementing them now. V1 is DFS only.

---

## maxNodes ownership

`maxNodes` is owned **only** by bounded search.

| Path | Reads `maxNodes`? |
|------|-------------------|
| `searchDeterministicCandidates` / certified bounded-search entry | Yes (required; null fails closed) |
| `optimizeSuppliedCandidates` / Phase 1G | No (evaluation budgets only) |
| Phase 1J generator | No (`maxGeneratedCandidates` only) |

`maxCandidates` / `maxEvaluations` are not read during search.
`maxGeneratedCandidates` is not owned by search.

---

## Exact node definition

A **node** is one visited assignment-tree state:

- root counts;
- each partial assignment counts;
- each complete assignment counts.

**Root-counting rule:** root is node 1.

**Cutoff:** after counting a node at `maxNodes`, children are not expanded. Before expanding each child, if `nodesVisited >= maxNodes`, stop and set `nodeBudgetExhausted=true`.

Never count a node that was not visited. `maxNodes=0` visits nothing and is node-budget exhausted.

---

## DFS V1 traversal

- Deterministic depth-first only.
- Variables ordered by `compareStableString(variableId)`.
- Values ordered by `compareStableString(valueId)`.
- Expand the next unassigned variable.
- Visit child states in canonical order.
- Emit **complete** assignments only.
- No partial candidate may enter CandidateBatch.
- No evaluation, ranking, pruning, feasibility callback, branch-and-bound, greedy, streaming, async, or random/host behavior.
- `sourceContext` does not influence search.

---

## maxEmittedCandidates

Separate from `maxNodes`. Emission stops as soon as `maxEmittedCandidates` complete candidates have been emitted (never emit beyond the cap).

**Exact-final-emission non-exhaustion rule** (mirrors approved exact-fit `maxNodes` behavior):

| Condition | `emittedCandidateBudgetExhausted` | `searchComplete` | Certified status |
|-----------|-----------------------------------|------------------|------------------|
| `maxEmittedCandidates` < total complete candidates | `true` | `false` | `BUDGET_EXHAUSTED` |
| `maxEmittedCandidates` === total complete candidates (exact-final emit) | `false` | `true` | preserves supplied `SUCCESS` / `INFEASIBLE` (not mapped to `BUDGET_EXHAUSTED`) |
| `maxEmittedCandidates` > total complete candidates | `false` | `true` | preserves supplied outcome |

Exhaustion means the emit cap **prevented traversal of at least one remaining complete candidate**. Merely reaching the configured limit on the final possible candidate is **not** exhaustion; exact-fit preserves `searchComplete=true`.

`searchComplete` is true only when the full canonical assignment tree was traversed (neither node nor emit budget stopped search).

Zero emitted candidates inside a truncated search is a valid structural result and must **not** be mislabeled as `INFEASIBLE` by the certified entry (it becomes `BUDGET_EXHAUSTED`).

---

## Candidate completion and IDs

Candidate ID policy matches Phase 1J exactly:

```text
candidateId = "cand-" + fingerprintValue({ assignments })
```

IDs identify assignment material only. Search version, `maxNodes`, traversal order, and envelope must not enter `candidateId`.

Structural CandidateBatch from search:

- `candidates` = complete emitted candidates
- `decisionVariables` compatible with request
- `objectiveExecutionSpecs = []`
- `authorityValues = []`
- context omitted unless an existing contract requires otherwise

---

## Evaluation timing

Evaluation occurs **after** structural traversal:

1. `searchDeterministicCandidates`
2. `applyCandidateEvaluationEnvelope`
3. `optimizeSuppliedCandidates` (canonical evaluation/ranking engine)

No objective evaluation during search.

---

## CandidateSourcePort adapter

`createDeterministicBoundedCandidateSource(searchSpec)` satisfies CandidateSourcePort without modifying the port.

**Limitation:** CandidateSourcePort returns CandidateBatch only. Search diagnostics (`nodesVisited`, budgets, `searchComplete`, …) remain on the direct search API and the certified optimization entry. The port is not semantically extended.

`sourceContext` is accepted for compatibility and ignored.

---

## Certified optimization entry

`optimizeDeterministicBoundedSearch(request, searchSpec, evaluationEnvelope, dependencies)`:

1. admit request + search spec;
2. assert envelope compatibility;
3. search;
4. apply envelope;
5. call existing `optimizeSuppliedCandidates`;
6. if `nodeBudgetExhausted` or `emittedCandidateBudgetExhausted` → status `BUDGET_EXHAUSTED` (no new status);
7. merge search identity into diagnostics where supported (`budgetUsage.nodes`, `budgetExhausted`) and into failure details / result fingerprint;
8. preserve ranked/evaluated information allowed by the current result contract.

---

## Fingerprint / replay

- Existing supplied-candidate optimizer fingerprint version (`CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2`) is unchanged.
- Bounded-search certified entry binds search identity into its own result fingerprint material:
  - search capability version, strategy, `maxNodes`, `nodesVisited`, `searchComplete`,
  - `nodeBudgetExhausted`, `maxEmittedCandidates`, `emittedCount`, `emittedCandidateBudgetExhausted`,
  - plus supplied-result fingerprint / selection material.
- Envelope semantic material enters evaluation-input fingerprinting after apply.
- Envelope / search metadata do not enter `candidateId`.

---

## Future strategies

Future deterministic strategies are optional and versioned. V1 does not implement BFS, greedy, exhaustive, beam, heuristic, or branch-and-bound.

---

## Domain-adapter boundary

CORE-10 does not own sibling domain algorithms (schedule, courts, referee, lineup, …). Domain adapters remain outside CORE-10.
