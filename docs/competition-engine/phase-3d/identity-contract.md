# Identity Contract — Phase 3D

## Formulas (Owner-locked)

```text
TEAM identityKey =
  competitionId + "::" + "TEAM" + "::" + stableTeamId

ROSTER identityKey =
  competitionId + "::" + "ROSTER" + "::" + teamId

ROSTER_MEMBER identityKey =
  competitionId + "::" + "ROSTER_MEMBER" + "::" + teamId + "::" + participantReference

participantReference = kind + ":" + id
```

## Rules

- Deterministic across resolves
- Competition-scoped
- No array index
- No wall-clock / `Date.now`
- No `Math.random` / UUID in resolver identity
- Display-name / color / logo changes do not alter key
- Collision → typed identity collision (no overwrite)
- Same key + same payload → idempotent
