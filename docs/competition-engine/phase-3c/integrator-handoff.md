# Integrator Handoff — Phase 3C

## Required Integrator Wave tasks

1. Re-export Registration Runtime public surface from `competition-core/index.js` (optional capability registration helper — no import-time auto-run).
2. Merge `scripts/ci/unit-test-files.phase-3c.json` into official `scripts/ci/unit-test-files.json`.
3. Optionally re-export new `entryRegistration.js` fields via `participants/contracts/index.js` if not already covered by existing export of `createCompetitionRegistration`.
4. Optionally add shared error-registry codes mirroring `REGISTRATION_RUNTIME_ERROR_CODE`.
5. Do **not** enable feature flags, Shadow, Production callers, or persistence.

## Closure conditions (Integrator)

- Official CI runs 3C tests
- Root export smoke test (no Production path change)
- Architecture lock / shared-file ownership still green
- Production safety defaults remain LEGACY_ONLY

## Not in this handoff

- Runtime cutover
- DB schema / RLS / RPC
- UI wiring
