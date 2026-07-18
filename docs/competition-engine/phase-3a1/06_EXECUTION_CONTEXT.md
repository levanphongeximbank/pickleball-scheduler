# 06 — Execution Context

`createExecutionContext` / `validateExecutionContext`.

Required injected fields:

```text
requestId, capability, format, now, timezone
```

Optional: `tenantId`, `competitionId`, `actor`, `randomSeed`, `runtimeVersion`, `capabilityVersions`, `configSnapshot`.

Resolvers never call system clock or RNG. Callers must inject `now` / `timezone` / `randomSeed`.
