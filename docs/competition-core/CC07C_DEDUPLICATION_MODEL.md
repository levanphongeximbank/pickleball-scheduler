# CC-07C — Deduplication Model

## Identity fields

- `sourceType`, `sourceId`, `constraintId`, `canonicalType`, `severity`, `scope`, `playerIds`, `ruleSetId`, `ruleSetVersion`

## Deduplication key

```
{sourceType}::{sourceId}::{canonicalType}::{scope}::{sortedPlayerPair}
```

Built by `buildRuleSourceIdentity()` / `buildDeduplicationKey()`.

## Flag behavior

| Flag | Behavior |
|---|---|
| OFF | No deduplication side effects on business output |
| ON | Legacy policy/rule/competition scores skipped via `skipCanonicalManagedScores`; canonical owns mapped founder rules |

## Modules

- `founderPolicyIdentity.js` — stable IDs
- `founderPolicyDeduplication.js` — plan, trace entries, shadow summary
- `ruleEvaluationOwnership.js` — owner resolution
