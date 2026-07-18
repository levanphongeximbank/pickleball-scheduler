# Registry Registration — Phase 3B Integrator Wave 1

## Entry point

```js
import { registerParticipantCapabilityWave1 } from
  "src/features/competition-core/index.js";

const result = registerParticipantCapabilityWave1();
// result.ok === true
// result.executor === "LEGACY"
```

## What is registered (descriptor-only)

| Registry | Content |
|----------|---------|
| Capability executor | `PARTICIPANT` → `LEGACY` → `participants/runtime/index.js` |
| Shadow comparator | modulePath → participant comparator |
| Shadow normalizer | modulePath → participant normalizer |
| Eligibility allowlist | operations: `["resolve"]` (descriptor only) |

Metadata includes `productionEnabled: false`, `shadowEnabled: false`.

## Guarantees

- Explicit call required (no import-time side effect)
- Deterministic module paths
- Idempotent re-registration of the same Wave 1 descriptors
- Does **not** invoke `ParticipantResolver`
- Does **not** change `RUNTIME_EXECUTOR` Production default
- Does **not** wire `resolveShadowEligibility` to allowlist (still unwired)
- Does **not** enable Shadow / persistence / cutover

## Import-time

Registries remain empty until `registerParticipantCapabilityWave1()` is called.
