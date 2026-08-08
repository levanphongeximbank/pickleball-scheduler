# Data Authority Cutover Map

## Canonical boundary

```
Canonical UI pages
  → tournamentQueries / tournamentCommands
    → TournamentRepository (factory)
      → transitionalBlobTournamentRepository (TEMPORARY)
      → cloudTournamentRepository (fail-closed until live SQL)
```

## Dual writers

| ID | Before | After (code) | Live status |
|----|--------|--------------|-------------|
| DW-01 | blob ↔ club_data_v3 full push | Single repository boundary; transitional still uses blob until cloud mode | Needs live SQL + env |
| DW-02 | EngineV4 ↔ events[] | `applyEngineV4StateCommand` sole apply path | Code ready; cloud RPC pending apply |
| DW-03 | team blob ↔ TT RPCs | No new local mirror; cutover flag unlocks `cloud_only` | Needs Owner env GO |

## Authorities after local cutover

| Concern | Classification |
|---------|----------------|
| Organizer list/create/my | `TRANSITIONAL_BLOB_BEHIND_CANONICAL_BOUNDARY` |
| Daily Play | `CANONICAL_BOUNDARY_REUSES_DAILY_ENGINE` |
| Team Tournament | `CLOUD_CAPABLE_NO_NEW_MIRROR` |
| EngineV4 | `CANONICAL_CONTEXTUAL_ENGINE` |
| Public tournaments | `CANONICAL_PUBLISHED_CLOUD_AUTHORITY` (remote default) |

## Removal path for transitional blob

1. Apply `sql/10_CANONICAL_TOURNAMENTS.sql`
2. Migrate blob tournaments → `canonical_tournaments`
3. `VITE_TOURNAMENT_CANONICAL_DATA_MODE=cloud`
4. Delete `transitionalBlobTournamentRepository.js`
