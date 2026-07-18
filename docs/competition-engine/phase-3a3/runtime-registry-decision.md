# Runtime Registry Decision — Phase 3A.3

## Question

Do we need a separate runtime adapter/executor registry **and** a capability registry?

## Decision

```text
ONE registry: Capability / Executor registry
NO separate Runtime Adapter registry in Phase 3A.3
```

## Rationale

1. Phase 3P ownership already lists “Capability / executor registry” as a single surface.
2. Early waves only need a place to declare `capability → modulePath + executor descriptor`.
3. A second registry would duplicate keys and increase Integrator conflict risk.
4. Adapters remain module-local under capability folders until cutover (Phase 3P: adapter registry OPTIONAL).

## CANONICAL executor

```text
RUNTIME_EXECUTOR.CANONICAL was NOT added to the Production enum.
```

Reasons:

- Adding it without activation still expands the public contract surface.
- Existing tests assert LEGACY-only values.
- Owner GO required before any CANONICAL constant/selection.

Capability registry rejects any non-`LEGACY` executor string until Owner changes policy.
