# CC-05C Shadow Architecture

## Flow

```
legacy payload
  → memoized legacy executor (single invocation)
  → direct legacy result = primary business output
  → evaluateCanonicalFormation(same memoized executor)
  → normalize + compare
  → trace record + parity report
```

## API

- `runFormationShadowComparison(input)` — primary output is always direct legacy
- `createMemoizedFormationExecutor(executor, payload)` — prevents double side effects

## Guarantees

- No database writes
- No queue/court state mutation from shadow layer
- Legacy executor invoked at most once per comparison
- `randomFn` reference tracked, not replaced

## Source

`src/features/competition-core/formation/adapters/formationShadowParity.js`
