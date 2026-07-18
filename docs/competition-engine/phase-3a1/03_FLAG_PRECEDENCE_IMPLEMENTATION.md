# 03 — Flag Precedence Implementation

Order (highest first), matching Phase 3.0:

```text
1. Kill switch (global → competition → tenant → format → capability)
2. Global disabled
3. Rollback marker
4. Competition disabled / override
5. Tenant disabled / override
6. Format flag
7. Capability flag
8. Shadow configuration
9. Default / CANONICAL_NOT_AVAILABLE (Phase 3A.1 clamp)
```

Implementation: `resolveFlagPrecedence` / `resolveKillSwitch`.

Even when flags would open a canonical path, Phase 3A.1 decision resolver clamps to `LEGACY_ONLY` with `CANONICAL_NOT_AVAILABLE` (or earlier blocking reason).
