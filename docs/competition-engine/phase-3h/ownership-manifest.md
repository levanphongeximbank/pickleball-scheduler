# Ownership Manifest — Phase 3H

## Capability owns

- `src/features/competition-core/draw-runtime/**`
- `tests/competition-core-draw-runtime-3h*.test.js`
- `scripts/ci/unit-test-files.phase-3h.json`
- `docs/competition-engine/phase-3h/**`

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
- Existing `draw/**` CC-04 foundation
- Existing `seed/**`, `seeding/**`, `matches/**`
- Production UI / SQL / RPC / Supabase
- Team / Individual / Daily Play engines
- Bracket / matchup / schedule Production engines
