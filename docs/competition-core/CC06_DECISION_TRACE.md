# CC-06 Decision Trace

## Phases

Player → Court → Pair → Score → Waiting → Result

## Trace record

`buildCompleteMatchmakingTraceRecord` captures:

- strategy, execution path, parity status
- decision path from `buildMatchmakingDecisionPath`
- randomFn preserved flag
- JSON-serializable; secrets redacted via `redactMatchmakingTraceSecrets`

## Source

`matchmakingDecisionTrace.js`, `matchmakingTraceVerification.js`
