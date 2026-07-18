# 02 — Runtime Control Contracts

## Modes

`LEGACY_ONLY | SHADOW | CANONICAL_READ | DUAL_WRITE | CANONICAL_PRIMARY | LEGACY_FALLBACK | CANONICAL_ONLY | RETIRED`

Phase 3A.1 activation: **LEGACY_ONLY only** (`isRuntimeModeActivatableInPhase3A1`).

Forbidden transition: `LEGACY_ONLY → CANONICAL_ONLY`.

## Scopes

`GLOBAL | CAPABILITY | FORMAT | TENANT | COMPETITION`

## Capabilities / formats

See `RUNTIME_CAPABILITY` and `RUNTIME_FORMAT` in `constants/runtimeScopes.js`.

## Executors (Phase 3A.1)

Only `LEGACY` is defined for selection. No canonical executor token is selectable.
