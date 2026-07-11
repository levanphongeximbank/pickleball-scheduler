# CC-04A — Draw Modes

## Canonical enum (`CANONICAL_DRAW_MODE`)

| Mode | Value |
|------|-------|
| SEEDED | `seeded` |
| OPEN | `open` |
| RANDOM | `random` |
| SNAKE | `snake` |
| HEURISTIC | `heuristic` |
| TEAM | `team` |
| MANUAL | `manual` |
| CUSTOM | `custom` |
| UNKNOWN | `unknown` |

## CC-01 DRAW_MODE (preserved)

| CC-01 | Canonical |
|-------|-----------|
| `pure_random` | `random` |
| `constrained_random` | `open` |
| `skill_controlled` | `snake` |
| `manual` | `manual` |

## Legacy runtime mapping (selected)

| Legacy | Canonical |
|--------|-----------|
| `open` (seeding UI) | `random` |
| `official_open` | `open` |
| `official_ai_balance` | `snake` |
| `skill_controlled` | `snake` |
| `heuristic` | `heuristic` |
| `mlp_auto_draw` | `team` |
| `lineup_random` | `random` |

Mapper: `mapLegacyDrawModeToCanonical()` — unknown → `unknown`. No runtime draw changes.
