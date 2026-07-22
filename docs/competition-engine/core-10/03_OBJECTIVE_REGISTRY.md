# CORE-10 — Objective Registry (Phase 1C-A)

**Module:** `src/features/competition-core/optimizer/objectives/`
**Versions:** `CORE10_OBJECTIVE_DEFINITION_SCHEMA_V1`, `CORE10_OBJECTIVE_REGISTRY_V1`, `CORE10_OBJECTIVE_EVALUATION_V1`

---

## Ownership

Phase 1C-A owns generic objective definitions, an immutable registry, and synchronous deterministic evaluation.

It does **not** own:

- candidate evaluation orchestration / hard-feasibility gate
- CORE-01 business-rule evaluation
- domain objectives (skill, fairness, seeding, grouping, schedule, court, referee)
- search solvers
- root `competition-core/index.js` integration

---

## Registry model

```text
createObjectiveRegistry([
  { definition: ObjectiveDefinition, evaluator: Function },
  ...
])
```

| Property | Rule |
|----------|------|
| Key | Nested `Map(objectiveId → Map(objectiveVersion → entry))` — collision-safe; no delimiter joining |
| Duplicate registration | Rejected (`DUPLICATE_OBJECTIVE_REGISTRATION`) |
| Singleton | **Forbidden** — no module-level global registry |
| Mutation after construction | **Forbidden** — API frozen; internal Map private |
| Execution order | **Not** from registry; from `executionSpecs` array order |
| `descriptorFingerprint()` | Schema/registry versions + definitions only; insertion-order independent |
| Evaluator functions | Runtime only — never serialized or fingerprinted |

### Public operations

- `resolve(objectiveId, objectiveVersion)` — owned definition clone + evaluator function reference
- `has(objectiveId, objectiveVersion)`
- `listDefinitions()` — owned immutable definition clones only (no evaluators)
- `descriptorFingerprint()`

---

## Evaluator contract

```text
evaluator({ definition, executionSpec, evaluationInput })
  → { rawValue: number, noteCodes?: string[] }
```

- Synchronous and pure.
- `evaluationInput` is an owned canonical frozen clone (caller object is never frozen in place).
- Promise/thenable → `ASYNC_OBJECTIVE_EVALUATOR_UNSUPPORTED` (checked before result schema validation).
- Thrown errors (non-contract) → `OBJECTIVE_EVALUATOR_EXCEPTION` (no message/stack in replay record).
- Called exactly once per objective evaluation.
- Evaluator output is copied before transformation.

### Required context

When `definition.requiredContextRefs` is non-empty:

- `evaluationInput.contexts` must be a plain object.
- Each required ref must be an **own property** of `contexts`.
- Own property with value `undefined` counts as **missing**.
- Prototype-chain properties do **not** satisfy required context.
- Failure code: `MISSING_OBJECTIVE_CONTEXT`.

---

## Value pipeline

| Stage | Rule |
|-------|------|
| Normalize | `NONE` only (`normalizedValue = rawValue`, `-0` → `+0`) |
| Quantize | `Math.round(normalizedValue * quantizeScale)` → safe integer (`-0` → `+0`) |
| Weight | `quantizedValue * weight` → safe integer |
| Orient | Phase 1B `orientObjectiveValue` (`-0` → `+0`) |

JavaScript `Math.round` half-away-from-zero / banker’s edge cases are documented in tests (`0.5`, `-0.5`, `1.5`, `-1.5`).

Overflow / non-finite / unsafe integer → fail closed (`OBJECTIVE_SCORE_OVERFLOW`, `NON_FINITE_OBJECTIVE_VALUE`, `UNSAFE_OBJECTIVE_INTEGER`). No sentinel scores. No partial records.

---

## Failure codes

See `OBJECTIVE_EVALUATION_FAILURE_CODE` (public enum object only). These are configuration/evaluation failures — **not** hard-constraint infeasibility and not run-level `INFEASIBLE`.

---

## Empty executionSpecs

`evaluateObjectives({ registry, executionSpecs: [], evaluationInput })` returns `Object.freeze([])` and invokes **no** evaluator.
