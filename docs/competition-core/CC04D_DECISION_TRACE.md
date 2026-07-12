# CC-04D — Decision Trace

**Phase:** CC-04D

## DrawDecisionTrace

Version: `cc04d-v1`

Each record captures:

- `consumer` — e.g. `internal_tournament`, `official_open`, `competition_engine`
- `usedCanonical` — true when DRAW_V2 adapter path used
- `executionPath` — `legacy` | `canonical-adapter`
- `path[]` — phased steps
- `metadata` — strategy id, group count

## Runtime path (flag ON)

```
Strategy
  ↓
Seed
  ↓
Distribution
  ↓
Constraint
  ↓
Balance
  ↓
Final placement
```

Builder: `buildDrawDecisionPath()`

Helpers:

- `createDrawDecisionTrace()`
- `appendDrawDecisionTrace()`
- `summarizeDrawDecisionTrace()`

## Audit linkage

`evaluateCanonicalDraw()` also produces `DrawAudit` with `distributionPath` string steps for CC-04A compatibility.

## Flag OFF

Single trace record: `"DRAW_V2 flag off — direct legacy runtime"`, `usedCanonical: false`.
