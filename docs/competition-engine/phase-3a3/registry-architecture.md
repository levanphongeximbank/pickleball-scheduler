# Registry Architecture — Phase 3A.3

## Selected model

```text
Four registries (Integrator-owned):
  1. Capability / executor registry
  2. Shadow comparator registry
  3. Shadow normalizer registry
  4. Shadow eligibility allowlist registry
```

## Common design

| Concern | Decision |
|---------|----------|
| Factory | `create*Registry()` for isolated tests |
| Singleton | `default*Registry` + convenience wrappers |
| Import-time side effects | **NONE** — empty on load |
| Duplicate | Reject with `DUPLICATE_REGISTRATION` |
| Unknown | Resolve failure with specific reason code |
| List order | Sorted by capability key (`localeCompare`) |
| Freeze | Optional `freeze()` → further mutations fail `REGISTRY_LOCKED` |
| Mutation of payloads | Registries store descriptors only |
| Fail-closed | Empty = no-op / deny |

## Location rationale

Placed under `runtime-control/` (and `shadow/registries/`) to match Phase 3P `runtime-registry-ownership.md`.  
Did **not** create a parallel `integration/` or top-level `registries/` tree (avoids duplicate abstraction).

## Not wired

Registries are **not** consulted by:

- `resolveRuntimeDecision`
- `resolveShadowEligibility`
- Production request paths

Capability phases register modules later; Integrator wires centrally after Owner GO.
