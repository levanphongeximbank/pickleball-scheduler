# CORE-10 — Candidate Evaluation Envelope (Phase 1L)

**Module:** `src/features/competition-core/optimizer/enrichment/`
**Capability version:** `CORE10_CANDIDATE_EVALUATION_ENVELOPE_V1`
**Capability:** Separate evaluation-ready objective/authority material from structural CandidateBatch content

---

## Purpose

Provide an immutable **Candidate Evaluation Envelope** that:

1. carries only `envelopeVersion`, `objectiveExecutionSpecs`, and `authorityValues`;
2. admits objective execution specs through the existing ObjectiveExecutionSpec contract;
3. rejects duplicate objective identities using existing Phase 1C-A rules;
4. admits authority values as safe integers under existing authority semantics;
5. can be asserted compatible with an OptimizationRequest;
6. can be applied onto a structural CandidateBatch to produce an evaluation-ready batch.

The envelope does **not** evaluate, rank, search, read budgets, or extend OptimizationRequest.

---

## Structural versus evaluation-ready CandidateBatch

| Kind | `objectiveExecutionSpecs` | `authorityValues` | Produced by |
|------|---------------------------|-------------------|-------------|
| Structural | `[]` | `[]` | Phase 1J generator / Phase 1L bounded search |
| Evaluation-ready | envelope specs | envelope authority | `applyCandidateEvaluationEnvelope` |

Structural batches preserve candidates, decision variables, and optional context. Evaluation enrichment replaces **only** specs and authority values.

---

## Envelope ownership

CORE-10 owns:

- `createCandidateEvaluationEnvelope`
- `applyCandidateEvaluationEnvelope`
- `assertCandidateEvaluationEnvelopeCompatible`
- capability version `CORE10_CANDIDATE_EVALUATION_ENVELOPE_V1`

CORE-10 does **not** own domain objective semantics, sibling CORE adapters, or request-policy mutation.

Envelope must **not** contain: context, metadata, sourceContext, candidate data, request data, or domain payload.

---

## Public APIs

| API | Role |
|-----|------|
| `createCandidateEvaluationEnvelope(partial)` | Validate, clone, deep-freeze envelope |
| `assertCandidateEvaluationEnvelopeCompatible(request, envelope)` | Request/envelope compatibility |
| `applyCandidateEvaluationEnvelope(batch, envelope)` | Produce evaluation-ready CandidateBatch |

Exported through `optimizer/enrichment/index.js` and `optimizer/index.js`.

---

## Compatibility rules

`assertCandidateEvaluationEnvelopeCompatible` verifies at minimum:

- envelope version is `CORE10_CANDIDATE_EVALUATION_ENVELOPE_V1`;
- request and envelope are safe immutable contracts;
- objective execution specifications are contract-valid;
- duplicate objective identities are rejected;
- `authorityValues.length === request.policy.authorityKeys.length`.

Authority values are caller-supplied. They are not derived from the request and have no invented defaults.

---

## Apply semantics

`applyCandidateEvaluationEnvelope`:

- admits the incoming CandidateBatch and envelope;
- returns a newly admitted CandidateBatch;
- preserves candidates, decisionVariables, candidate IDs, assignments, and existing batch context;
- replaces only `objectiveExecutionSpecs` and `authorityValues`;
- does not mutate either input;
- deeply freezes output;
- does not evaluate, rank, or read budgets;
- does not change candidate identity.

After apply, evaluation-input fingerprinting continues to bind specs and authority through existing evaluation contracts.

---

## Determinism

- Synchronous only; Promise/thenable rejected.
- Unknown fields rejected; non-plain objects rejected; accessors rejected.
- Caller-owned values cloned; output deeply frozen.
- No `localeCompare`, random, wall-clock, or host state.
- Spec array order preserved for the evaluator.

---

## Domain-adapter boundary

Domain adapters remain outside CORE-10. The envelope is a generic evaluation enrichment contract only.
