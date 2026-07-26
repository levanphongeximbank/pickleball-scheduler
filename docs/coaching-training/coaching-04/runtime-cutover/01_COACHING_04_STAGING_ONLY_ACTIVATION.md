# COACHING-04 — Staging-Only Durable Activation

## Why not flip the global default?

`COACHING_DURABLE_RUNTIME_DEFAULT` is a hardcoded compile-time constant shared by every environment that ships the build. Setting it to `true` would activate durable mode on Production as well.

## Staging-only gate

Module: `src/features/coaching/runtime/stagingDurableGate.js`

| Input | Required for activate=true |
|-------|----------------------------|
| `VITE_COACHING_STAGING_DURABLE_RUNTIME_ENABLED` | exact `"true"` |
| `VITE_APP_ENV` | `staging` |
| Owner GO | `ownerGoGranted=true` + token `COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING` |
| Supabase URL ref (when present) | `qyewbxjsiiyufanzcjcq` |

Production / unknown / non-staging / flag off / missing GO → `activate=false` (legacy remains).

Composition: `createDefaultCoachingRuntime` consults the gate **only after** confirming `COACHING_DURABLE_RUNTIME_DEFAULT === false`. Default Preview/Production builds keep legacy.

## Impact of changing the default

| Change | Production impact |
|--------|-------------------|
| Flip `COACHING_DURABLE_RUNTIME_DEFAULT=true` | **Yes — affects all envs** (forbidden) |
| Staging Vite flag only | No Production impact when `VITE_APP_ENV≠staging` |
| Explicit `createCoachingRuntime({ mode: "durable" })` | Test/injection only |

## This package phase

Flag remains unset/false. Gate reason = `flag-off`. `runtimeActivated=false`.
