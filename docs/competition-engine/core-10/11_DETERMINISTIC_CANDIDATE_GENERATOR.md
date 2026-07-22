# CORE-10 — Deterministic Candidate Generator (Phase 1J)

**Module:** `src/features/competition-core/optimizer/generation/`
**Capability version:** `CORE10_DETERMINISTIC_CANDIDATE_GENERATOR_V1`
**Capability:** Bounded synchronous deterministic Cartesian Candidate Batch generation behind Candidate Source Port

---

## Purpose

Provide a **domain-neutral**, **string-domain-only**, **complete** Cartesian candidate generator that:

1. validates an explicit Deterministic Candidate Generation Spec;
2. checks compatibility against an OptimizationRequest decision domain;
3. fails closed on unsafe or over-cap cardinality;
4. enumerates every assignment combination in canonical order;
5. assigns deterministic `candidateId` values from assignment fingerprints;
6. returns a frozen Candidate Batch via `createCandidateBatch`;
7. integrates through the existing Candidate Source Port into `optimizeCandidateSource`.

Phase 1J does **not** evaluate, rank, search, prune, stream, randomize, or own optimization budgets.

---

## Ownership

### CORE-10 owns

- DeterministicCandidateGenerationSpec validation / canonicalization / freeze
- Request / Spec decision-domain compatibility checks
- Safe Cartesian cardinality preflight (`maxGeneratedCandidates`)
- Deterministic complete enumeration
- Deterministic `candidateId` policy (`cand-` + assignment fingerprint)
- `generateCandidateBatch`
- `createDeterministicCandidateSource` (CandidateSourcePort factory)
- Capability version `CORE10_DETERMINISTIC_CANDIDATE_GENERATOR_V1`
- Capability-local exports
- Focused Phase 1J tests

### CORE-10 does not own

- Domain schedule / court / referee assignment generation
- Domain adapters for CORE-09 / CORE-11 / CORE-12 / CORE-13 / CORE-14
- Greedy / exhaustive search strategies
- `maxNodes` traversal
- Lazy / streaming / async production
- Evaluation, ranking, feasibility pruning during generation
- Root `competition-core/index.js` integration

Do not import sibling CORE private implementations.

---

## Public APIs

| API | Role |
|-----|------|
| `createDeterministicCandidateGenerationSpec(partial)` | Validate, canonicalize, deep-freeze Generation Spec |
| `generateCandidateBatch(request, spec)` | Produce frozen Candidate Batch |
| `createDeterministicCandidateSource({ portId, portVersion?, spec })` | CandidateSourcePort wrapping the generator |
| `CORE10_DETERMINISTIC_CANDIDATE_GENERATOR_V1` | Default `portVersion` for the source factory |

Exported only through `src/features/competition-core/optimizer/index.js` (and `generation/index.js`).

---

## Generation Spec

Factory: `createDeterministicCandidateGenerationSpec(partial)`

| Field | Required | Notes |
|-------|----------|-------|
| `variables` | yes | Non-empty array |
| `maxGeneratedCandidates` | yes | Positive safe integer (`> 0`) |

Each variable:

| Field | Notes |
|-------|-------|
| `variableId` | Stable non-empty string ID; unique across Spec |
| `valueIds` | Non-empty array of stable string IDs; unique within the variable |

Rules:

- Plain synchronous object only; Promise / thenable rejected.
- Unknown fields fail closed.
- Zero variables, empty `valueIds`, duplicate IDs, non-string `valueIds`, and invalid `maxGeneratedCandidates` (zero, negative, fraction, NaN, Infinity, unsafe integer) fail closed.
- Canonicalize: variables sorted by `compareStableString(variableId)`; each `valueIds` array sorted by `compareStableString`.
- Caller Spec is never mutated; result is deep-frozen.

---

## String-only valueId rule

Generation Spec `valueIds` are **strings only**.

Request decision-variable domains may contain `string | number | boolean | null`, but only **string** domain members are legal generated `valueId` values. No conversion from number / boolean / null to string is performed.

---

## Request compatibility

`generateCandidateBatch` requires:

- every Generation Spec variable corresponds to one request decision variable;
- every request decision variable appears exactly once in the Spec;
- every Spec `valueId` is a legal string member of the matching request domain;
- missing variables, extra variables, and illegal values fail closed (`INVALID_REQUEST`, or decision-domain codes when the request domain itself is invalid).

Domains are never inferred from context, objectives, authority values, or sibling modules.

---

## Deterministic ordering

Exact enumeration order:

1. Canonical variables sorted by `variableId`.
2. Each value domain sorted by `valueId`.
3. Nested Cartesian iteration follows canonical variable order (first variable outermost).
4. Each candidate assignments array is ordered by `variableId`.

Output is independent of:

- original request decision-variable order;
- original Spec variable order;
- original `valueId` order.

Forbidden: `localeCompare`, `Math.random`, `Date`, timers, process/env/network/database/UI state.

---

## Candidate completeness

- Complete Cartesian product only (after cardinality guard).
- No partial candidates.
- No repeated variable assignments within a candidate.
- No empty-assignment candidates.
- No semantic pruning or feasibility checks during generation.
- A valid non-empty Spec never produces an empty Candidate Batch.

---

## candidateId policy

```text
candidateId = "cand-" + fingerprintValue({ assignments: [{ variableId, valueId }, ...] })
```

Fingerprint material binds **only** canonical assignments.

Not bound:

- `requestId` / request context
- `sourceContext`
- objective specs / authority values
- generator version / source version / `portId`
- enumeration ordinal / emission order
- time / random / host state

Equivalent canonical assignments ⇒ same `candidateId`.
Candidate Batch duplicate-ID validation remains the final collision guard.

---

## Cardinality guard

Before materializing candidates:

```text
product(valueIds.length for every canonical variable)
```

- Safe-integer checks; early stop when product would exceed `maxGeneratedCandidates` or overflow.
- Over-cap / overflow ⇒ `OptimizerContractError` with `INVALID_REQUEST` and `details.reason = "GENERATION_LIMIT_EXCEEDED"`.
- No silent truncation; no prefix generation.
- Does **not** read `request.deterministicBudget.maxCandidates`, `maxEvaluations`, or `maxNodes`.

---

## Budget / maxNodes non-ownership

| Concern | Owner |
|---------|-------|
| `maxGeneratedCandidates` | Phase 1J generator |
| `maxCandidates` / `maxEvaluations` | Phase 1G `optimizeSuppliedCandidates` |
| `maxNodes` | Not used on supplied / source-backed path |

Generation consumes no optimization evaluation budget.

---

## No evaluation / ranking / search / randomization

Phase 1J does not:

- evaluate candidates;
- rank candidates;
- attach evaluation / ranking / budget data;
- perform feasibility checks during generation;
- run greedy / exhaustive / branch-and-bound search;
- prune;
- stream or lazily iterate;
- use ambient randomness.

---

## Synchronous full-batch boundary

- `generateCandidateBatch` and source `produce` are synchronous only.
- Full Candidate Batch is returned (not an iterator / Promise).
- Thenable arguments and thenable Spec are rejected.

---

## CandidateSourcePort integration

```text
createDeterministicCandidateSource({ portId, portVersion?, spec })
  → createCandidateSourcePort({
      portId,
      portVersion: portVersion ?? CORE10_DETERMINISTIC_CANDIDATE_GENERATOR_V1,
      produce(request) => generateCandidateBatch(request, closedSpec)
    })
```

- Closes over an immutable Generation Spec.
- `sourceContext` is accepted for port compatibility and is **not** read, merged, copied into assignments, or used in IDs / cardinality.
- Ordinary producer failures and `OptimizerContractError` remain governed by CandidateSourcePort.
- Consumed by existing `optimizeCandidateSource` without modifying Phase 1I / 1F/1G orchestration.

Generated Candidate Batch fields:

| Field | Value |
|-------|-------|
| `candidates` | Generated complete set |
| `decisionVariables` | Structural clone from request |
| `objectiveExecutionSpecs` | `[]` (generator does not own evaluation envelope) |
| `authorityValues` | `[]` |
| `context` | omitted (request context fallback remains Phase 1I / 1G behavior) |

---

## Fingerprint parity

Direct `generateCandidateBatch` → `optimizeSuppliedCandidates` and source-backed `optimizeCandidateSource` over the same Spec / request must preserve Phase 1I fingerprint parity for equivalent Candidate Batch content.

Not bound into OptimizationResult fingerprint:

- generator capability version;
- `portId` / `portVersion`;
- `sourceContext`.

---

## Versioning

Constant: `CORE10_DETERMINISTIC_CANDIDATE_GENERATOR_V1`

Bump this capability version when changing:

- candidate ID policy;
- canonical ordering;
- completeness policy;
- string-domain policy;
- cardinality-guard semantics;
- Generation Spec schema.

Do **not** modify `CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2` for Phase 1J.
Do **not** bind the generator version into `candidateId` or OptimizationResult fingerprint material.

---

## Exports

Capability-local:

- `createDeterministicCandidateGenerationSpec`
- `generateCandidateBatch`
- `createDeterministicCandidateSource`
- `CORE10_DETERMINISTIC_CANDIDATE_GENERATOR_V1`
- `CORE10_IDENTITY.deterministicCandidateGeneratorV1`

Root `src/features/competition-core/index.js` remains unchanged.

---

## Exclusions / non-claims

Phase 1J is **not**:

- production Global Optimizer completion;
- domain schedule / court / referee assignment generation;
- greedy or exhaustive search completion;
- `maxNodes` support;
- streaming / lazy / async production;
- evaluation or ranking during generation;
- an overload of `optimizeSuppliedCandidates` or a change to `optimizeCandidateSource` behavior.

---

## Future boundaries

| Future concern | Boundary |
|----------------|----------|
| Domain adapters | Own CandidateSourcePort implementations; may call or replace this generator |
| Search strategies | Separate later phases; must not overload this Cartesian generator |
| Non-string domains | Explicit future adapter / schema change + version bump |
| Streaming generation | Out of Phase 1J scope |
