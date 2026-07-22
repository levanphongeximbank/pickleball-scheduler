# CORE-10 — Supplied-Candidate Evaluation-Budget Termination (Phase 1G)

**Module:** `src/features/competition-core/optimizer/orchestration/`
**Version:** `CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2`
**Capability:** deterministic evaluation-budget termination on the supplied-candidate path

---

## Scope

Phase 1G extends the existing synchronous API:

```text
optimizeSuppliedCandidates(
  optimizationRequest,
  suppliedCandidateBatch,
  evaluationDependencies
) → frozen OptimizationResult
```

without changing its signature.

It enforces **deterministic evaluation-budget termination** for caller-supplied candidates under `CONTRACT_ONLY`. It does **not** generate candidates, search, run greedy/exhaustive solvers, consume wall-clock budgets, invent node accounting, or claim production global optimization is complete.

---

## Unchanged API

- Public function name remains `optimizeSuppliedCandidates`.
- Argument order and types remain unchanged.
- Exported only through `src/features/competition-core/optimizer/index.js`.
- Root `src/features/competition-core/index.js` remains unchanged.
- No new public budget helpers or alternate orchestration entry points.

---

## Effective evaluation-limit calculation

Reuse the existing `deterministicBudget` contract fields only:

| Field | Type | Role on supplied path |
|-------|------|------------------------|
| `maxCandidates` | `number \| null` | evaluation-cap dimension |
| `maxEvaluations` | `number \| null` | evaluation-cap dimension |
| `maxNodes` | `number \| null` | **ignored** for evaluation capping (no search nodes) |

Algorithm:

1. Collect non-null values from `maxCandidates` and `maxEvaluations`.
2. If one or both are non-null → `effectiveEvaluationLimit = min(non-null values)`.
3. If both are null → no evaluation cap in this phase (includes the valid case where only `maxNodes` is set).
4. Zero is a real finite limit (evaluate zero candidates), not unlimited.
5. `null` means that dimension is unset.

Examples:

| Budget | Effective limit |
|--------|-----------------|
| `maxCandidates=10`, `maxEvaluations=null` | 10 |
| `maxCandidates=null`, `maxEvaluations=4` | 4 |
| `maxCandidates=10`, `maxEvaluations=4` | 4 |
| `maxCandidates=0` | 0 |
| only `maxNodes=100` | unlimited evaluations on this path |

Do not invent node accounting. `budgetUsage.nodes` remains `0`.

---

## Null versus zero

- `null` on a dimension → that dimension does not constrain the limit.
- `0` on `maxCandidates` or `maxEvaluations` → finite limit of zero evaluations.
- Both evaluation dimensions null → unlimited evaluations for this path (even if `maxNodes` is set).

---

## Canonical termination

Admission and canonicalization happen **before** evaluation:

1. Admit the full supplied batch (fail closed).
2. Canonicalize by `candidateId` via `compareStableString` (UTF-16 code units).
3. Derive the effective evaluation limit.
4. Evaluate only the prefix slice of the canonical list (or the full list when unlimited / within budget).
5. Rank **only** the evaluated subset via Phase 1D.
6. Project SUCCESS / INFEASIBLE when the full admitted batch was evaluated; otherwise `BUDGET_EXHAUSTED`.

Caller input order never affects the evaluated subset, ranking, or result fingerprint.

---

## Full versus truncated behavior

Let:

- `admittedCount` = number of admitted supplied candidates
- `evaluatedCount` = number actually evaluated
- `truncated` = a finite limit exists **and** `admittedCount > effectiveEvaluationLimit`

### Empty supplied batch (precedence)

Empty batch ⇒ Phase 1F `INFEASIBLE` semantics. This **takes precedence** over budget exhaustion (including a zero limit).

- `status = INFEASIBLE`
- `candidateCount = 0`, `evaluationCount = 0`
- `budgetExhausted = false`, `watchdogTimeout = false`

### Batch fits within budget (or unlimited)

Evaluate every admitted candidate. Preserve Phase 1F semantics:

- feasible winner ⇒ `SUCCESS`
- all evaluated infeasible ⇒ `INFEASIBLE`
- `budgetExhausted = false`

### Batch exceeds effective budget

Evaluate exactly the first `effectiveEvaluationLimit` candidates in canonical order.

Then return:

- `status = BUDGET_EXHAUSTED`
- failure code = `BUDGET_EXHAUSTED`
- `budgetExhausted = true`
- `watchdogTimeout = false`
- `selectedCandidateId` = best among the evaluated subset when ranking produces one; otherwise `null`
- `rankedCandidateIds` = deterministic ranking of the **evaluated subset only**
- `evaluationCount` = evaluated subset size
- `candidateCount` = full admitted batch size
- feasible / infeasible counts from evaluated subset only
- `nodes = 0`

Never return `SUCCESS` for a truncated batch.

### Zero limit with non-empty batch

Evaluate zero candidates → `BUDGET_EXHAUSTED` with null selection, empty ranking, `evaluationCount=0`, `candidateCount=admittedCount`, `budgetExhausted=true`.

### Truncated all-infeasible evaluated subset

Return `BUDGET_EXHAUSTED`, **not** `INFEASIBLE`. Unevaluated candidates remain unknown.

---

## BUDGET_EXHAUSTED semantics

- Uses the existing status and failure-code enums / factories.
- Means: a finite evaluation budget truncated a non-empty admitted batch before full evaluation.
- Best-evaluated-so-far may still be selected when the evaluated subset contains a feasible winner.
- Partial `rankedCandidateIds` list only evaluated candidates; it is not a claim about unevaluated IDs.
- Never emitted for an empty batch.
- Never emitted for a complete within-budget evaluation.

---

## Diagnostics meanings

Existing diagnostics schema only (no new fields):

| Field | Meaning |
|-------|---------|
| `candidateCount` | full admitted supplied candidate count |
| `evaluationCount` (via `budgetUsage.evaluations`) | actual evaluated count |
| `budgetUsage.candidates` | full admitted candidate count |
| `budgetUsage.evaluations` | actual evaluated count |
| `budgetUsage.nodes` | always `0` |
| `budgetExhausted` | `true` only when a finite budget truncates a non-empty batch |
| `watchdogTimeout` | always `false` in this phase |

Not introduced: `admittedCandidateCount`, `evaluatedCandidateIds`, `completionStatus`, `terminationReason`, `lastEvaluatedCandidate`.

---

## Replay implications

Replay metadata continues to echo the request `deterministicBudget` via existing `createReplayMetadata`. Termination is bound by discrete counters and canonical order — not wall-clock duration. Result fingerprint binds Phase 1G capability version V2 plus rankable result material (status, failure code, selection, ranking, counts, `budgetExhausted`). No timestamps / `Date.now`.

---

## Fingerprint version V2

Active fingerprint / failure capability version:

`CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2`

Historical Phase 1F constant `CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION` (`…_V1`) is retained for compatibility. V2 is exported from the optimizer capability barrel. Root barrel unchanged.

Fingerprint material minimally binds:

- Phase 1G capability version V2
- existing Phase 1F-style request/ranking material
- `status`, failure code, `selectedCandidateId`, `rankedCandidateIds`
- `candidateCount`, `feasibleCandidateCount`, `infeasibleCandidateCount`
- `evaluationCount`, `budgetExhausted`

Identical semantic input ⇒ stable fingerprint. Complete vs exhausted executions that differ materially ⇒ different fingerprints.

---

## Explicit exclusions

- Wall-clock watchdog / `Date.now` / timers / elapsed-time checks / external cancellation
- Candidate generation / greedy search / exhaustive search / recursive search
- Node-based search accounting on this path
- Sibling CORE imports (CORE-01 / 09 / 11–14, Schedule / Court / Referee)
- Root `competition-core/index.js` export
- New diagnostics / result schema fields
- Production claim that global optimization is complete

---

## Ownership and public export boundaries

Phase 1G owns deterministic evaluation-budget termination inside `optimizeSuppliedCandidates` and capability-local docs/tests.

Phase 1G does **not** own: generator/search strategies, Phase 1E zero-budget projection internals, schema shape changes, UI, SQL, Supabase, root barrel exports.

Public capability-local exports added/retained:

- `optimizeSuppliedCandidates` (unchanged name)
- `CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION` (V1 historical)
- `CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2`
