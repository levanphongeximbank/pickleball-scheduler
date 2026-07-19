# Ownership Manifest — Phase 3G

## Capability owns

- `src/features/competition-core/seeding/**`
- `tests/competition-core-seeding-runtime-3g*.test.js`
- `scripts/ci/unit-test-files.phase-3g.json`
- `docs/competition-engine/phase-3g/**`

## Integrator owns (later)

- Root re-exports in `competition-core/index.js`
- Merge into `scripts/ci/unit-test-files.json`
- Optional shared error-registry mirror
- Runtime-control registration (if ever approved)

## Must not touch

- `runtime-control/**`
- `config/featureFlags.js`
- `competition-core/index.js`
- `scripts/ci/unit-test-files.json`
- Existing `seed/**` CC-04B foundation (read-only reference; not rewritten)
- `matches/**`, `draw/**`, `lineups/**`, `teams/**`, `registrations/**`
- Production UI / SQL / RPC / Supabase
- Team / Individual / Daily Play engines
