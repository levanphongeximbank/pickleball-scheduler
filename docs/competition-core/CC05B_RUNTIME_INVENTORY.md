# CC-05B Runtime Inventory

Adapter version: `cc05b-v1`

## Audited formation runtime paths

| Legacy key | Runtime function | Path | Strategy | Callers |
|------------|------------------|------|----------|---------|
| `mlp_team_pairing` | `pairTeamsFromSelectedPlayers` | `teamAutoDrawEngine.js` | TEAM_MATCH | TeamAiPairingDialog |
| `ai_balance` | `runAI` | `ai/engine.js` | BALANCED | SelectPlayers, dailyPlayEngine |
| `daily_play_fair` | `runAI` | `dailyPlayEngine.js` | BALANCED | Daily Play flows |
| `mixed_doubles` | `createMixedPairsFromPlayers` | `teamPairingEngine.js` | MIXED | suggestTeamsFromPlayers |
| `snake_pairing` | `createTeamsFromPlayers` | `tournament.seeding.logic.js` | SNAKE | teamPairingEngine |
| `fixed_partner` | `optimizeTeamsWithConstraints` | `constraintPairingEngine.js` | FIXED_PARTNER | teamPairingEngine |
| `pure_random` | `pairingEngine` | `ai/pairing.js` | RANDOM | runAI |
| `rotation` | `queueService` | court-engine | ROTATION | court flows |
| `king_of_court` | `kingOfCourt` | court-engine | KING_OF_COURT | court flows |
| `custom` | `manualPairingOverride` | pairing-intervention | CUSTOM | intervention flows |
| `ai_assistant` | `buildPairingSuggestion` | ai-assistant | BALANCED | aiEngineService |
| `open_double` | `suggestTeamsFromPlayers` | `teamPairingEngine.js` | BALANCED | tournament setup |

## CC-05B adapter scope

Only **MLP team pairing wizard** is wired in this phase.

All other paths are inventoried for CC-05C+ integration.

## Source

`src/features/competition-core/formation/adapters/formationRuntimeInventory.js`
