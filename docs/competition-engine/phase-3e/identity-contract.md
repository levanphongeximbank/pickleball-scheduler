# Identity Contract — Phase 3E

## Formulas (Owner-locked)

```text
LINEUP identityKey =
  competitionId + "::" + "LINEUP" + "::" + contextId + "::" + teamId

SLOT id =
  lineupIdentityKey + "::" + disciplineOrSideKey + "::" + index
```

`contextId` is the opaque matchup / fixture reference (legacy `matchupId`).

## Rules

- Deterministic across resolves
- Competition-scoped
- No wall-clock / `Date.now`
- No `Math.random` / UUID in resolver identity
- Display-name / visibility flags / ratings do not alter key
- Collision → typed identity collision (no overwrite)
- Same key + same payload → idempotent
- Slot `index` is position within `disciplineOrSideKey` (canonically meaningful)
