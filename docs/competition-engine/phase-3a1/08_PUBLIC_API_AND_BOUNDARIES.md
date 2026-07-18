# 08 — Public API and Boundaries

## Public exports

Via `src/features/competition-core/index.js` (runtime-control section):

- Mode / scope / capability / format / executor constants
- `RUNTIME_DECISION_CODE`
- Factories: context, flags, overrides, decision, diagnostics, audit
- Validators
- `resolveKillSwitch`, `resolveFlagPrecedence`, `resolveRuntimeMode`, `resolveRuntimeDecision`

## Boundaries

```text
runtime-control ↛ pages/, components/, UI
runtime-control ↛ Supabase / clubStorage
runtime-control ↛ format-local executors
runtime-control ↛ process.env / Date.now / Math.random
runtime-control ↛ persistence writes
```

Architecture tests: `tests/competition-core-runtime-control-3a1-architecture.test.js`.
