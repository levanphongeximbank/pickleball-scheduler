# 05 — Runtime Decision Model

`resolveRuntimeDecision({ context, flags, overrides })` → JSON-safe decision:

```text
selectedMode
selectedExecutor      # always LEGACY in 3A.1
canonicalAllowed      # always false in 3A.1
shadowAllowed         # always false in 3A.1
fallbackAllowed
reasonCode
evaluatedScopes[]
diagnostics[]
auditEvent
```

Fail-safe: invalid context / flags / overrides → `LEGACY_ONLY` + diagnostics (no throw).

Does **not** import or call any business executor.
