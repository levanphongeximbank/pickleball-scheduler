# Integrator Handoff — Phase 3H

## Required Integrator Wave tasks (NOT started)

1. Re-export Draw Runtime public surface from `competition-core/index.js` (no import-time auto-run).
2. Merge `scripts/ci/unit-test-files.phase-3h.json` into official `scripts/ci/unit-test-files.json`.
3. Optionally add integrator smoke test.
4. Optionally add shared error-registry codes mirroring `DRAW_RUNTIME_ERROR_CODE`.
5. Optionally define executable `HYBRID` composition (Core rejects `HYBRID` with `DRAW_UNSUPPORTED_MODE`).
6. Do **not** enable feature flags, Shadow, Production callers, or persistence.

## Closure conditions (Integrator)

- Official CI runs 3H tests
- Root export smoke test (no Production path change)
- Architecture lock / shared-file ownership still green
- Production safety defaults remain LEGACY_ONLY
- Seeding / Match / Lineup / Team / Registration remain behavior-stable

## Not in this handoff

- Runtime cutover
- DB schema / RLS / RPC
- UI wiring
- Matchup Runtime
- Scheduling Runtime
- Modification of legacy `draw/**`
