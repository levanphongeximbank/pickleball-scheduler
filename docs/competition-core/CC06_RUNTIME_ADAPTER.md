# CC-06 Runtime Adapter

## Flow

```
Legacy payload
  → mapLegacyMatchmakingPayloadToMatchmakingRequest
  → buildLegacyRunAIOptions (randomFn preserved)
  → legacyExecutor(players, options)  // runAI unchanged
  → mapLegacyMatchmakingResultToMatchmakingResult
  → adaptMatchmakingResultForLegacyConsumer (output preserved)
```

## Entry points

| Function | Purpose |
|----------|---------|
| `evaluateCanonicalMatchmaking` | Flag-gated bridge; returns trace + parity metadata |
| `runLegacyMatchmakingWithCanonicalAdapter` | Explicit adapter invocation |
| `runDailyMatchmakingWithCanonicalAdapter` | Daily play payload builder + adapter |
| `executeCompetitionEngine(MATCHMAKING)` | Competition Core engine consumer path |

## Feature flag

`VITE_COMPETITION_CORE_MATCHMAKING_V2_ENABLED` + master `VITE_COMPETITION_CORE_ENABLED`.

Both must be `true` for canonical path. Legacy `runAI` always executes the algorithm.

## Source

`src/features/competition-core/matchmaking/adapters/matchmakingRuntimeAdapter.js`
