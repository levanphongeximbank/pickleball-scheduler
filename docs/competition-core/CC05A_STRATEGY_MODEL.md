# CC-05A — Strategy Model

**Phase:** CC-05A

## FORMATION_STRATEGY enum

| Value | Legacy key |
|-------|------------|
| `balanced` | ai_balance |
| `random` | pure_random |
| `snake` | snake_pairing |
| `rotation` | rotation |
| `king_of_court` | king_of_court |
| `mixed` | mixed_doubles |
| `fixed_partner` | fixed_partner |
| `rotating_partner` | rotating_partner |
| `team_match` | mlp_team_pairing |
| `custom` | custom |
| `unknown` | fallback |

Catalog: `CANONICAL_FORMATION_STRATEGY_CATALOG` (10 strategies)

Mapper: `mapLegacyFormationStrategyToCanonical()`

Inventory: `LEGACY_FORMATION_STRATEGY_INVENTORY`

## FormationPolicy

`strategy`, `allowRandomization`, `maxSkillGap`, `targetCourtCount`, `params`

No runtime execution in CC-05A.
