# CC-04E — Team Draw Integration

**Phase:** CC-04E | **Algorithm:** NOT changed

## Integration

Team group draw now routes through `runTeamDrawWithCanonicalAdapter()`:

- **UI:** `TeamGroupDivisionPanel.jsx` → `runGroupAssignment()`
- **Legacy executor:** `assignSeededTeamsToGroups()` (unchanged)
- **Strategy:** `mlp_auto_draw` → `CANONICAL_DRAW_STRATEGY_ID.TEAM`

## Flag behavior

| Flag | Behavior |
|------|----------|
| DRAW_V2 OFF | Direct `assignSeededTeamsToGroups` |
| DRAW_V2 ON | Canonical request/trace → same executor → preserved output |

## Seeding modes preserved

- `TEAM_GROUP_SEEDING.OFF` — random shuffle
- `TEAM_GROUP_SEEDING.AVG_LEVEL` — average level snake
- `TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL` — ace + total tie-break

## Module

`src/features/competition-core/draw/adapters/teamDrawAdapter.js`

## Out of scope

- Team Formation algorithm (CC-05)
- Team Tournament persistence
- UI business rule changes
