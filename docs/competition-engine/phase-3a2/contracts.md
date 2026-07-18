# Contracts — Phase 3A.2

## Shadow execution request

Factory: `createShadowExecutionRequest`

| Field | Notes |
|-------|-------|
| `competitionId` | string \| null |
| `capability` | required for valid requests |
| `operation` | required for valid requests |
| `correlationId` | required for valid requests |
| `executionContext` | Phase 3A.1 execution context (injected `now` / seed) |
| `legacyInput` | cloned JSON-safe payload |
| `canonicalInput` | cloned JSON-safe payload |
| `runtimeDecision` | Phase 3A.1 decision object |
| `metadata` | opaque map |

Immutable by convention: factories clone inputs; resolvers must not mutate caller objects.

## Shadow execution plan

Factory: `createShadowExecutionPlan` / resolver `resolveShadowExecutionPlan`

| Field | Default |
|-------|---------|
| `primaryExecution` | `LEGACY` |
| `shadowExecution` | `NONE` (or `CANONICAL` when eligible plan) |
| `resultReturnSource` | `LEGACY` |
| `shadowExecutionEnabled` | `false` |
| `canonicalInvocationAllowed` | `false` |

## Result envelope

Factory: `createShadowResultEnvelope`

Holds injected fixture results only in Phase 3A.2:

```text
legacyResult, canonicalResult,
legacyError, canonicalError,
legacyDurationMs, canonicalDurationMs,
executionMetadata
```

## Version

`SHADOW_INFRASTRUCTURE_VERSION = "3a2.0"`
