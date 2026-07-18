# Public Export Convention — Phase 3A.3 (Option B)

## Rule

```text
Capability-local index exports new symbols.
Integrator re-exports into root competition-core/index.js.
```

## Ownership

| File | Owner |
|------|-------|
| `competition-core/<capability>/index.js` | Capability chat |
| `competition-core/index.js` | **CHAT I only** |
| `runtime-control/index.js` | **CHAT I only** |
| `runtime-control/shadow/index.js` | **CHAT I only** |
| `participants/index.js` | **CHAT I only** |

## Phase 3A.3 exports

Only bootstrap infrastructure (registries, reason codes, factories).  
No capability business runtimes exported.

## Compatibility

All pre-3A.3 exports remain. Regression covered in `competition-core-runtime-registry-3a3.test.js`.
