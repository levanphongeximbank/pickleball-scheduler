# Capability Registry Contract — Phase 3A.3

## API

```js
import {
  createCapabilityExecutorRegistry,
  registerCapabilityExecutor,
  resolveCapabilityExecutor,
  listCapabilityExecutorRegistrations,
  REGISTRY_REASON_CODE,
} from ".../competition-core";
```

### Entry shape

```text
{
  capability: RUNTIME_CAPABILITY,   // required
  executor: RUNTIME_EXECUTOR,       // LEGACY only until Owner GO
  modulePath: string | null,        // documentation / future wiring
  metadata: object                  // optional frozen copy
}
```

### Result shape

```text
Success: { ok: true, reasonCode: "OK", value: entry }
Failure: { ok: false, reasonCode, errors: string[] }
```

## Behaviors

| Case | reasonCode |
|------|------------|
| Invalid capability | `INVALID_CAPABILITY_ID` |
| Invalid entry | `INVALID_REGISTRY_ENTRY` |
| Duplicate | `DUPLICATE_REGISTRATION` |
| Unknown resolve | `CAPABILITY_NOT_REGISTERED` |
| Frozen | `REGISTRY_LOCKED` |

## Implemented now

Descriptor registration + lookup + list + freeze + factory.

## Reserved

Actual executor invocation / CANONICAL executor.

## Forbidden

Auto-run on import; selecting non-LEGACY executor; Production dispatch.
