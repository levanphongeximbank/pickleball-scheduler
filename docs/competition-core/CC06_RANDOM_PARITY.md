# CC-06 Random Parity

## Rules

- `randomFn` on payload root or `options.randomFn` is passed through `buildLegacyRunAIOptions`.
- Clone preserves function reference (`verifyMatchmakingRandomParity`).
- Adapter never replaces or re-seeds randomness.

## Source

`legacyMatchmakingPayloadMappers.js`, `matchmakingPayloadPreservation.js`
