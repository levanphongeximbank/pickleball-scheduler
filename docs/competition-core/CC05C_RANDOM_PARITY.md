# CC-05C Random Parity

## Checks

- `randomFn` reference preserved on payload clone
- Memoized shadow: single executor invocation
- `randomFnCallCount` tracked via instrumented wrapper in tests
- No adapter-injected `Math.random`

## Limitation

If legacy engine does not support deterministic replay, documented as legacy limitation — not adapter failure.

## Source

`formationShadowParity.js`, `formationPayloadPreservation.js`
