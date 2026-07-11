# CC-03A — Execution Pipeline

**Phase:** CC-03A | **Date:** 2026-07-12

---

## 1. Pipeline steps

```
normalizeInput()
  → resolveContext()
  → expandApplicableRules()
  → detectConstraintConflicts()
  → validateEligibility()
  → validateHardConstraints()
  → scoreSoftConstraints()        // only when feasible
  → aggregateResult()
  → buildExplanation()
```

Entry point: `evaluateCandidate(candidate, constraintsOrRuleSet, context, options)`

Legacy envelope: `evaluateCanonicalRules(ruleSet, context, options)`

---

## 2. Step details

| Step | Module | Output |
|------|--------|--------|
| `normalizeInput` | `normalizeInput.js` | Normalized rule set, context, candidate |
| `resolveContext` | `resolveContext.js` | Canonical `ConstraintContext` |
| `expandApplicableRules` | `expandApplicableRules.js` | Context-filtered constraints |
| `detectConstraintConflicts` | `detectConflicts.js` | Structural conflict list |
| `validateEligibility` | `validateHardConstraints.js` | Entry eligibility gate |
| `validateHardConstraints` | `validateHardConstraints.js` | `feasible` + hard violations |
| `scoreSoftConstraints` | `scoreSoftConstraints.js` | Numeric soft score (never rejects) |
| `aggregateResult` | `aggregateResult.js` | `ConstraintEvaluationResult` envelope |
| `buildExplanation` | `buildExplanation.js` | Rich explanations with resolutions |

---

## 3. Flag gate

When `isConstraintsV2Enabled(envSource)` is `false`:

- Pipeline short-circuits after normalize
- Returns `{ enabled: false, feasible: true, softScore: 0 }`
- **No legacy behavior change**

---

## 4. Hard vs soft invariant

| Layer | Rejects candidate? | Uses negative totalScore hack? |
|-------|-------------------|-------------------------------|
| Hard | Yes (`feasible: false`) | No |
| Soft | No | No — explicit weighted penalties only |

When hard fails, soft scoring is **skipped** (`softScore: 0`).

---

## 5. Pure evaluator guarantee

No Supabase, fetch, or database imports in the constraints pipeline. Domain-only evaluation.

---

## 6. CC-03B (not started)

Wiring to legacy consumers remains out of scope until owner GO.
