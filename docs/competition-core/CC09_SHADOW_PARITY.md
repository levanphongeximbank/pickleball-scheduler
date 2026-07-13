# CC-09 — Shadow Parity

Source: `schedulingShadowParity.js` → `buildSchedulingShadowComparison`

## Compared dimensions

| Dimension | Field |
|---|---|
| Match membership | membershipParity |
| Round order | roundParity |
| Court assignment | courtParity |
| Time slot / start | timeParity |
| BYE placement | byeParity |
| Manual overrides | overrideParity |
| Referee assignment | refereeParity |
| Warnings/errors | warningParity |

## Report fields

`ok`, `mismatches[]`, `unsupportedLegacyBehavior[]`, `contextMissing`

## Memoization

`createMemoizedSchedulingExecutor` — legacy executor invoked once; duplicate invocation flagged in trace.

## Business rule

**Legacy output is always returned** in shadow mode. Canonical result is comparison-only. No persistence or duplicate side effects.

## Entry

`runSchedulingShadowComparison({ consumer, legacyPayload, legacyExecutor, envSource })`
