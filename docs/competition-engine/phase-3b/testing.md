# Testing — Phase 3B

## Files

| File | Role |
|------|------|
| `tests/competition-core-participant-runtime-3b.test.js` | Unit coverage |
| `tests/competition-core-participant-runtime-3b-architecture.test.js` | Architecture / safety |
| `scripts/ci/unit-test-files.phase-3b.json` | Phase sub-manifest (Option D) |

## Coverage

- resolve success
- participant missing
- duplicate / identity collision
- unsupported source
- invalid mapping
- guest preserved / guest loss refused
- legacy adapter
- persistence stub (opt-in)
- shadow parity (non-Production)
- architecture: no Production wiring, no Canonical adapter, flags remain OFF

## How to run (capability chat)

```powershell
node --test tests/competition-core-participant-runtime-3b.test.js tests/competition-core-participant-runtime-3b-architecture.test.js
```

Official `npm run test:unit` will **not** include these until Integrator merges the sub-manifest into `unit-test-files.json`.
