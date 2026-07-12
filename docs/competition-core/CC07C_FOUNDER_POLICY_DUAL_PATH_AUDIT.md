# CC-07C — Founder Policy Dual-Path Audit

Baseline: TT-4 (`92142db`) + CC-07 orchestration (`346cbd5`, `afbd6ab`).

## Runtime path

```
Founder constraints (pairing-constraints)
  → courtPolicyAdapter.constraintsToCourtPolicies()
  → AI context.policies (source=founder, stable sourceId)
  → scoring.calculatePairScore()
      → evaluateLegacyAiPairScore()
          → mapAiContextToRuleSet() [canonical]
          → evaluateCanonicalRulesRuntime()
  Legacy parallel (flag OFF only):
      → calculatePolicyScore() (-120 hard avoid, soft penalties)
```

## Duplicate risk inventory

| rule source | source id | legacy path | canonical path | severity | legacy score | canonical score | duplicate risk | consumer | resolution |
|---|---|---|---|---|---|---|---|---|---|
| founder_policy | `founder-{constraintId}-avoid_teammate-{a}-{b}` | `calculatePolicyScore` | `AVOID_PARTNER` hard | hard | -120 | reject (-100 envelope) | HIGH | ai_scoring | CANONICAL owner; legacy suppressed |
| founder_policy | same | `calculatePolicyScore` | `AVOID_PARTNER` soft | soft | -35 | soft delta | HIGH | ai_scoring | CANONICAL owner; legacy suppressed |
| founder_policy | same | `calculatePolicyScore` | `PREFER_PARTNER` soft | soft | +15 / -15 | soft delta | HIGH | ai_scoring | CANONICAL owner; legacy suppressed |
| pairing_constraint | aligned sourceId | pairing evaluator | `mapPairingConstraintsToRuleSet` | varies | legacy score | canonical | MED | pairing_constraints | separate consumer; dedup when bridged into AI plan |
| club_rule | rule id | `calculateRuleScore` | mapped SKILL/REPEAT | soft | legacy | canonical | MED | ai_scoring | skipCanonicalManagedScores when V2 ON |

## CC-07C resolution

- Stable `sourceId` on court policies and canonical constraint metadata.
- `buildFounderPolicyDeduplicationPlan()` assigns single evaluation owner per deduplication key.
- Hard founder avoid: one canonical reject; no simultaneous -120.
- Soft founder rules: one canonical soft contribution.
- Duplicate adapter mappings → `SKIPPED_DUPLICATE` in trace summary.
