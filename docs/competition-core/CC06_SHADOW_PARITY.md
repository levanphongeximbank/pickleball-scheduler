# CC-06 Shadow Parity

## Architecture

1. **Primary** — direct legacy `runAI` (memoized single invocation).
2. **Shadow** — canonical adapter path over same memoized executor.
3. **Compare** — `buildMatchmakingParityComparison` checks courts, waiting, aiScore.

## Guarantees

- `executorInvocationCount === 1` (no double side effects).
- `comparison.ok === true` when adapter preserves legacy output.
- Court allocation, waiting list, and score breakdown parity flags.

## Source

`src/features/competition-core/matchmaking/adapters/matchmakingShadowParity.js`
