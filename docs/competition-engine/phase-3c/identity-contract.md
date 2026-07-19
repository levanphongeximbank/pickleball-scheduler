# Identity Contract — Phase 3C

## Formula

```text
identityKey = competitionId + "::" + registrationKind + "::" + stableSourceIdentity
```

## Rules

- Deterministic across resolves
- Competition-scoped
- No array index
- No wall-clock / `Date.now`
- No `Math.random` / UUID in resolver identity
- Display-name changes do not alter key
- Collision → `REGISTRATION_IDENTITY_COLLISION` (no overwrite)
- Same key + same payload → idempotent

## Stable source identity

| Kind | stableSourceIdentity |
|------|----------------------|
| INDIVIDUAL | legacy `entry.id` |
| TEAM | `teamId` (fallback source id) |

Official BTC uses INDIVIDUAL kind; distinction is `sourceType = OFFICIAL_BTC`.
