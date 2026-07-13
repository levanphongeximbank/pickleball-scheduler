# CC-10 — Feature Flag Matrix

## Flags

| Flag | Key | Default | Requires CORE | Production |
|---|---|---|---|---|
| Master | `VITE_COMPETITION_CORE_ENABLED` | false | — | OFF |
| Rating | `VITE_COMPETITION_CORE_RATING_V2_ENABLED` | false | yes | OFF |
| Rules | `VITE_COMPETITION_CORE_RULES_V2_ENABLED` | false | yes | OFF |
| Rules alias | `VITE_COMPETITION_CORE_CONSTRAINTS_V2_ENABLED` | false | yes (alias) | OFF |
| Draw | `VITE_COMPETITION_CORE_DRAW_V2_ENABLED` | false | yes | OFF |
| Formation | `VITE_COMPETITION_CORE_FORMATION_V2_ENABLED` | false | yes | OFF |
| Matchmaking | `VITE_COMPETITION_CORE_MATCHMAKING_V2_ENABLED` | false | yes | OFF |
| Standings | `VITE_COMPETITION_CORE_STANDINGS_V2_ENABLED` | false | yes | OFF |
| Scheduling | `VITE_COMPETITION_CORE_SCHEDULING_V2_ENABLED` | false | yes | OFF |

## Governance rules (verified)

- Missing value → `false` (`parseEnvBoolean`)
- Invalid value (`maybe`, empty) → `false`
- Sub-flag without CORE → `false`
- Master ON alone does **not** enable any module
- Centralized readers: `config/featureFlags.js`, `config/envReader.js`, `config/rulesV2FlagReader.js`
- Adapter env fallbacks use `import.meta.env` only when no explicit `envSource` passed (documented pattern)
- Production env files **not modified** in CC-10

## Staging shadow recommendation (not applied in CC-10)

```
VITE_COMPETITION_CORE_ENABLED=true
VITE_COMPETITION_CORE_RULES_V2_ENABLED=true
VITE_COMPETITION_CORE_DRAW_V2_ENABLED=true
VITE_COMPETITION_CORE_FORMATION_V2_ENABLED=true
VITE_COMPETITION_CORE_MATCHMAKING_V2_ENABLED=true
VITE_COMPETITION_CORE_STANDINGS_V2_ENABLED=true
VITE_COMPETITION_CORE_SCHEDULING_V2_ENABLED=true
VITE_COMPETITION_CORE_RATING_V2_ENABLED=false  # until RPC verified on target staging
```
