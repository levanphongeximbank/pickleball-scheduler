# CC-06 Runtime Inventory

Adapter version: `cc06-v1`

## Audited daily matchmaking runtime paths

| Legacy key | Runtime function | Path | Strategy | Callers |
|------------|------------------|------|----------|---------|
| `ai_balance` | `runAI` | `src/ai/engine.js` | BALANCED | SelectPlayers.jsx |
| `daily_play_fair` | `createDailyMatchesWithAI` | `src/tournament/engines/dailyPlayEngine.js` | DAILY_PLAY | DailyPlaySetup, tournamentDirectorEngine |
| `waiting_priority` | `runWaitingEngine` | `src/ai/waiting.js` | WAITING_PRIORITY | runAI |
| `pairing_engine` | `runPairingEngine` | `src/ai/pairing.js` | BALANCED | runAI |
| `director_lock` | `runAI` | `src/ai/engine.js` | DIRECTOR_LOCK | SelectPlayers.jsx |
| `balance_engine` | `runBalanceEngine` | `src/ai/balance.js` | BALANCED | runAI |
| `history_engine` | `runHistoryEngine` | `src/ai/history.js` | BALANCED | runAI |
| `director_engine` | `runDirectorEngine` | `tournamentDirectorEngine.js` | DAILY_PLAY | Director flows |

## CC-06 adapter scope

Canonical adapter wraps **legacy `runAI`** without UI wiring.

All paths are inventoried; consumers may opt in via `evaluateCanonicalMatchmaking` or `executeCompetitionEngine(MATCHMAKING)`.

## Source

`src/features/competition-core/matchmaking/adapters/matchmakingRuntimeInventory.js`
