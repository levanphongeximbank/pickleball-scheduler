# Phase 3B Entry Criteria — After Phase 3A.3

Phase 3B (Participant Runtime) may start **only** when Owner confirms all of:

- [ ] Phase 3A.3 merged to `main`
- [ ] Registry boundaries on main
- [ ] Root export convention documented + implemented
- [ ] Sub-manifest convention documented + 3a3 validated
- [ ] Shared-file ownership rules documented + guard available
- [ ] Legacy default regression tests pass on main
- [ ] Shadow remains OFF; eligibility default false
- [ ] No canonical invocation
- [ ] No Production request-path changes from 3A.3
- [ ] CHAT I ownership documented
- [ ] Phase 3B allowed / forbidden file scope published (below)
- [ ] Official test manifest integration process documented

## Phase 3B allowed file scope (preview)

From Phase 3P `branch-strategy.md` / `file-ownership-map.md`:

```text
participants/runtime/**
participants/contracts/identity.js
participants/contracts/competitionParticipant.js
participant validators/mappings/ports modules (not barrels)
format participant adapters (map-only)
tests/competition-core-participant*-3b*.test.js
scripts/ci/unit-test-files.phase-3b.json
docs/competition-engine/phase-3b/**
```

## Phase 3B forbidden file scope

```text
src/features/competition-core/index.js
runtime-control barrels + registries (Integrator)
scripts/ci/unit-test-files.json
featureFlags.js
legacyAdapter.js
entryRegistration.js / teamRosterLineup.js (other phases)
Production wiring / flag enable / DB migrations
```

## Chat I must NOT open Phase 3B

Owner opens Chat 1 after this checklist is green.
