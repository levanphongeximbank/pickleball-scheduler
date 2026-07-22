# CORE-10 — Candidate Evaluation (Phase 1C-B1)

**Module:** `src/features/competition-core/optimizer/`
**Versions:** `CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_V1`, `CORE10_CANDIDATE_EVALUATION_DEPENDENCIES_V1`, `CORE10_HARD_VIOLATION_SCHEMA_V1`, `CORE10_CONSTRAINT_EVALUATION_PORT_V1`, `CORE10_HARD_VIOLATION_COMPOSITION_V1`

---

## Ownership

Phase 1C-B1 owns:

- per-candidate status and failure-code enums (preparatory / classification);
- replay-safe `CandidateEvaluationInput`;
- runtime `CandidateEvaluationDependencies` guard;
- synchronous `ConstraintEvaluationPort` contract;
- replay-safe `HardViolation`;
- deterministic hard-violation composition;
- structural candidate-input validation/classification.

Phase 1C-B1 does **not** own:

- `evaluateCandidateSolution` / hard-feasibility gate orchestration (Phase 1C-B2);
- `CandidateEvaluationResult` / score composition / objective orchestration (Phase 1C-B2);
- final evaluation-result fingerprint certification (Phase 1C-C);
- CORE-01 business-rule implementation or adapters;
- search solvers, candidate generation, Schedule / Court / Referee, persistence, UI.

---

## Status model (preparatory)

```text
VALID_FEASIBLE | VALID_INFEASIBLE | INVALID_CANDIDATE | EVALUATION_FAILED
```

Distinct from run-level `OPTIMIZATION_STATUS`. Phase 1C-B1 does not yet emit `VALID_FEASIBLE` / `VALID_INFEASIBLE` pipeline outcomes.

---

## Assignment facts

```text
{ variableId: string, valueId: string }
```

- Assignments are an array; duplicate `variableId` rejected.
- **Every** declared `DecisionVariable` must receive **exactly one** assignment (not only `required: true`).
- Unknown variable IDs fail; assignment count must equal decision-variable count.
- Canonical owned order: stable sort by `variableId` (caller array not mutated).
- `valueId` must appear as a **string** member of the decision-variable domain.
- Own-property reads only; inherited prototype values do not satisfy required fields.
- No embedded player/team/match/court/referee objects.

---

## Scope classification (consistent)

Tenant / competition / operation / snapshot binding failures on candidate evaluation input are classified with Phase 1C-B codes:

| Condition | Code |
|-----------|------|
| Tenant mismatch | `TENANT_SCOPE_MISMATCH` |
| Competition mismatch | `COMPETITION_SCOPE_MISMATCH` |
| Operation mismatch / unsupported | `OPERATION_MISMATCH` |
| Snapshot binding problem | `INVALID_SNAPSHOT_BINDING` |

These are configuration / input-classification failures for the candidate-evaluation request — **not** HardViolations and **not** run-level `INFEASIBLE`.

---

## Constraint port

```text
createConstraintEvaluationPort({
  portId,
  portVersion,
  evaluateConstraints(frozenInput) → { violations, noteCodes? }
})
```

Returned port exposes **only**:

- `portId`
- `portVersion`
- controlled `evaluateConstraints` (wrapper; raw evaluator stays in a closure)

- Port required on dependencies — no `allowMissingPort`.
- Operations without business constraints must receive an **explicit** no-op port created at the call site, e.g.:

```text
portId: CORE10_NOOP_CONSTRAINT_PORT
portVersion: CORE10_CONSTRAINT_EVALUATION_PORT_V1
evaluateConstraints: () => ({ violations: [], noteCodes: [] })
```

**No module-level singleton. No exported no-op fixture.**

- Synchronous only; Promise/thenable → `ASYNC_CONSTRAINT_PORT_UNSUPPORTED` (checked before result schema validation).
- Exceptions → `CONSTRAINT_PORT_EXCEPTION` (no message/stack in replay-safe output).
- `violations` is **required** and must be an array (empty allowed); missing → `INVALID_CONSTRAINT_PORT_RESULT`.
- Violations validated through `createHardViolation`.

---

## Structural validation

`validateCandidateEvaluationInput` returns:

```text
{ ok: true, input }
| { ok: false, code, messageCode, details }
```

- `code` and `messageCode` are stable Phase 1C-B failure codes (same value in Phase 1C-B1).
- `details` contains canonical IDs / scalars only.
- Free-text display messages are **not** part of the replay-safe failure object.

Invalid shape/domain/scope conditions **do not** create `HardViolation` objects, **do not** call the constraint port, and **do not** evaluate objectives.

---

## Hard-violation composition

`composeHardViolations(...groups)`:

1. Copy all inputs; re-validate via `createHardViolation`.
2. Stable sort (documented order).
3. Deduplicate exact duplicates.
4. Identity key = canonical serialization of `{ sourceModule, sourceVersion, violationCode, constraintId, affectedIds }` (no delimiter joining).
5. Conflicting magnitude → `HARD_VIOLATION_MAGNITUDE_CONFLICT`.
6. Conflicting messageCode/detailsCodes → `DUPLICATE_HARD_VIOLATION`.

Hard violations are never transformed into objective values.
