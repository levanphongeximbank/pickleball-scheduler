# Ownership Manifest — Phase 3F

## Capability owns

- `src/features/competition-core/matches/**`
- `tests/competition-core-match-runtime-3f*.test.js`
- `scripts/ci/unit-test-files.phase-3f.json`
- `docs/competition-engine/phase-3f/**`

## Integrator owns (later)

- Root re-exports in `competition-core/index.js`
- Merge into `scripts/ci/unit-test-files.json`
- Optional shared error-registry mirror
- Runtime-control registration (if ever approved)

## Must not touch

- `runtime-control/**`
- `config/featureFlags.js`
- `participants/runtime/**`
- `registrations/**`, `teams/**`, `lineups/**` behavior
- Production UI / SQL / RPC / Supabase
- Scoring Runtime / Scheduling Runtime
