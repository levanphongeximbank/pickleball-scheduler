# CORE-10 — Candidate Ranking (Phase 1D)

**Module:** `src/features/competition-core/optimizer/ranking/`
**Version:** `CORE10_CANDIDATE_RANKING_V1`
**Comparator:** `CORE10_COMPARATOR_V1` (via `sortScoresDeterministic`)

---

## Ownership

Phase 1D owns:

- synchronous `rankCandidateEvaluations(frontier)` over already evaluated candidates;
- deterministic `rankedCandidateIds` and feasible-winner `selectedCandidateId`;
- throw-only ranking failure codes;
- capability-local ranking tests and documentation.

Phase 1D does **not** own:

- candidate generation / search / `DETERMINISTIC_GREEDY` / `EXHAUSTIVE`;
- `OptimizationResult` projection or replay/diagnostics fabrication (Phase 1E);
- changes to `evaluateCandidateSolution` or `CandidateEvaluationResult` schema;
- new fingerprints or attachment onto evaluation results;
- CORE-01 adapters, Schedule / Court / Referee, persistence, UI;
- root `competition-core/index.js` export.

---

## Public API

```text
rankCandidateEvaluations(frontier) → frozen ranking view
```

### Input

- `frontier`: array of plain `CandidateEvaluationResult` objects (already created).
- Each item is revalidated through `createCandidateEvaluationResult` (owned clone).
- Only `VALID_FEASIBLE` and `VALID_INFEASIBLE` are accepted.
- Requires non-null `optimizationScore` with `score.candidateId === result.candidateId`.
- Duplicate `candidateId` values fail closed.
- Promise/thenable frontiers or elements fail closed.
- Empty array is valid.

### Output (frozen plain object — not a new versioned contract schema)

| Field | Notes |
|-------|--------|
| `rankedCandidateIds` | Frozen owned string array; comparator order |
| `selectedCandidateId` | Best feasible ID, or `null` if empty / all infeasible |
| `rankedScores` | Frozen owned `OptimizationScore[]`; aligned with IDs |
| `feasibleCount` / `infeasibleCount` | From ranked scores; sum equals frontier length |
| `rankingVersion` | `CORE10_CANDIDATE_RANKING_V1` |

Infeasible candidates remain in `rankedCandidateIds` (after all feasible).

---

## Determinism

1. Reuses `sortScoresDeterministic` / `compareOptimizationScores` only — no comparator fork.
2. Order: feasible → hardViolationCount ↑ → authorityValues → objectiveValues → stable `candidateId`.
3. Input order never influences output (unique IDs required).
4. `displayTotal` and fingerprints never participate in ranking.
5. Caller frontier array and elements are never mutated or frozen in place.
6. No `Math.random`, `Date.now`, `localeCompare`, or environment-dependent ordering.

---

## Failure codes (throw-only)

| Code | When |
|------|------|
| `INVALID_CANDIDATE_RANKING_INPUT` | Non-array/thenable frontier, non-rankable status, missing score, identity mismatch, malformed admission |
| `DUPLICATE_CANDIDATE_ID` | Repeated `candidateId` in frontier |

Malformed result envelopes may also propagate `INVALID_CANDIDATE_EVALUATION_RESULT` from revalidation.

Ranking failures are **not** stored on `CandidateEvaluationResult` / `CandidateEvaluationFailure`.

---

## Public exports (capability-local)

`rankCandidateEvaluations`, `CANDIDATE_RANKING_FAILURE_CODE`, `CORE10_CANDIDATE_RANKING_VERSION`.

Not exported: revalidation helpers, score-ownership helpers. Root barrel unchanged.
