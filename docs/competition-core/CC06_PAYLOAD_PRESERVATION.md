# CC-06 Payload Preservation

## Mapped fields

- `players`, `courts`, `options`, `strategyKey`, `sessionId`, `clubId`, `tournamentId`
- `lockedCourts`, `lockedPlayers`, `randomFn`, `randomSeed`

## Unmapped extensions

Custom top-level fields (e.g. `customExtension`) are reported via `verifyMatchmakingPayloadPreservation` warnings — not dropped silently.

## Output preservation

`isLegacyMatchmakingOutputPreserved` deep-compares courts, waiting, aiScore between direct legacy and adapter output.

## Source

`matchmakingPayloadPreservation.js`, `legacyMatchmakingResultMappers.js`
