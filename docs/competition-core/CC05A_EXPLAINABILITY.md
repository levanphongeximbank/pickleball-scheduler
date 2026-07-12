# CC-05A — Explainability

**Phase:** CC-05A

## FormationExplanation

Fields: `code`, `title`, `message`, `playerAId`, `playerBId`, `decisionPath[]`, `reasons[]`, `scoreBreakdown`, `details`

## Decision path

```
Player A
  ↓
Partner B
  ↓
Reason
  ↓
Constraint summary
  ↓
Score breakdown
  ↓
Final decision
```

Builder: `createFormationDecisionExplanation()`

Attached to `buildFoundationFormationResult()` explanations array.

No persistence in CC-05A.
