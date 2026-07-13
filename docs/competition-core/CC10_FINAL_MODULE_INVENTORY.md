# CC-10 — Final Module Inventory

Base: `00317e95058b5e195c3b89623cfe98925fffecad`

| Module | Version | Canonical path | Adapter | Flag | Business owner | Classification |
|---|---|---|---|---|---|---|
| Rating V2 | CC-02 | `rating/` | RPC + mapping | `RATING_V2` | Legacy Elo/RPC | SHADOW_READY (staging RPC verified) |
| Rules V2 | CC-03/07 | `constraints/` | `rulesRuntimeOrchestrator` | `RULES_V2` | Legacy | SHADOW_READY |
| Seed pipeline | CC-04 | `seed/` | draw/seed mappers | (draw) | Legacy | SHADOW_READY |
| Draw V2 | CC-04 | `draw/` | `drawRuntimeAdapter` | `DRAW_V2` | Legacy | SHADOW_READY |
| Formation V2 | CC-05 | `formation/` | `formationRuntimeAdapter` | `FORMATION_V2` | Legacy | SHADOW_READY |
| Matchmaking V2 | CC-06 | `matchmaking/` | `matchmakingRuntimeAdapter` | `MATCHMAKING_V2` | Legacy | SHADOW_READY |
| Standings V2 | CC-08 | `standings/` | `standingsRuntimeAdapter` | `STANDINGS_V2` | Legacy | SHADOW_READY |
| Scheduling V2 | CC-09 | `scheduling/` | `schedulingRuntimeAdapter` | `SCHEDULING_V2` | Legacy | SHADOW_READY |
| Decision Trace | all modules | per-module trace builders | all adapters | n/a | audit only | SHADOW_READY |
| Shadow comparison | all modules | `*ShadowParity.js` | all adapters | n/a | comparison only | SHADOW_READY |
| Feature flags | CC-01 | `config/featureFlags.js` | n/a | `CORE` master | governance | CANONICAL_READY |
| Execution modes | CC-10 | `config/executionMode.js` | centralized resolver | n/a | routing | CANONICAL_READY |
| Legacy orchestration | CC-01 | `adapters/legacyAdapter.js` | `executeCompetitionEngine` | per-module | legacy primary | LEGACY_PRIMARY |

Production activation: **NOT PERFORMED** — all modules remain legacy-primary in production.
