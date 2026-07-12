# CC-05B Random Parity

## Rule

The canonical formation adapter **must not inject a new random source**.

Legacy `randomFn` on payload or `options.randomFn` is passed through unchanged to the legacy executor.

## Verification

| Function | Purpose |
|----------|---------|
| `resolveLegacyFormationRandomFn(payload)` | Read randomFn without creating one |
| `verifyFormationRandomParity(before, after)` | Assert reference equality |
| `bridge.randomFnPreserved` | Set on `evaluateCanonicalFormation()` result |

## Clone behavior

`cloneLegacyFormationPayload()` preserves:

- `payload.randomFn` function reference
- `payload.options.randomFn` function reference
- `payload.options.playersById` Map reference

## Test coverage

- Clone preserves Map/randomFn references
- Adapter path does not alter randomFn after evaluation
- Shadow comparison includes `randomFnPreserved` gate

## Source

`legacyFormationPayloadMappers.js`, `formationShadowParity.js`
