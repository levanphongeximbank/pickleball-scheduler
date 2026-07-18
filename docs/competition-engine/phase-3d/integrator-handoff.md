# Integrator Handoff — Phase 3D

## Required Integrator Wave tasks (Wave 2)

1. Re-export Team Runtime public surface from `competition-core/index.js` (optional capability registration helper — no import-time auto-run).
2. Merge `scripts/ci/unit-test-files.phase-3d.json` into official `scripts/ci/unit-test-files.json`.
3. Optionally re-export new `identityKey` team/roster fields via `participants/contracts/index.js` if needed.
4. Optionally add shared error-registry codes mirroring `TEAM_RUNTIME_ERROR_CODE`.
5. Do **not** enable feature flags, Shadow, Production callers, or persistence.

## Closure conditions (Integrator)

- Official CI runs 3D tests
- Root export smoke test (no Production path change)
- Architecture lock / shared-file ownership still green
- Production safety defaults remain LEGACY_ONLY
- Registration Runtime remains untouched

## Not in this handoff

- Runtime cutover
- DB schema / RLS / RPC
- UI wiring
- Lineup Runtime (3E)
