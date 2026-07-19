# Integrator Handoff — Phase 3E

## Required Integrator Wave tasks

1. Re-export Lineup Runtime public surface from `competition-core/index.js` (no import-time auto-run).
2. Merge `scripts/ci/unit-test-files.phase-3e.json` into official `scripts/ci/unit-test-files.json`.
3. Optionally add shared error-registry codes mirroring `LINEUP_RUNTIME_ERROR_CODE`.
4. Do **not** enable feature flags, Shadow, Production callers, or persistence.

## Closure conditions (Integrator)

- Official CI runs 3E tests
- Root export smoke test (no Production path change)
- Architecture lock / shared-file ownership still green
- Production safety defaults remain LEGACY_ONLY
- Team / Registration / Participant Runtime remain behavior-stable

## Not in this handoff

- Runtime cutover
- DB schema / RLS / RPC
- UI wiring
- Match Runtime
- Random / deadline / reveal execution
