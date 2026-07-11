# CC-04A — Draw Explainability

`DrawExplanation` captures placement rationale without UI:

```
Player X
  → Seed #3
  → Snake distribution
  → Group B
  → Balanced average level
  → Club separation satisfied
  → Random seed / heuristic score (in metadata/audit)
```

Fields: `code`, `title`, `message`, `playerId` / `entryId`, `seedNumber`, `groupId`, `distributionPath[]`, `reasons[]`, `details`.

Used by audit + result envelopes. No rendering in CC-04A.
