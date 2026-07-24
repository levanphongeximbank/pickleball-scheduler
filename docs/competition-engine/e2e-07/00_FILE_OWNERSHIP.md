# E2E-07 — File Ownership

## Owned (this workstream)

```
src/features/competition-engine/certification/**/*
src/features/competition-engine/presentation/certification/**/*
src/features/competition-engine/operations/certification/index.js   # re-export barrel only
tests/competition-engine-e2e-07-*.test.js
docs/competition-engine/e2e-07/**/*
scripts/ci/unit-test-files.json                                    # additive test registration
```

## Additive shared barrels (minimal)

- `src/features/competition-engine/index.js` — selective certification exports
- `src/features/competition-engine/operations/index.js` — harness marker + entry factories
- `src/features/competition-engine/presentation/index.js` — `buildCertificationSections`

## Explicitly NOT owned

- E2E-00..06 source/docs (frozen)
- Core/CM capability engines
- `package.json` / lockfile
- Production runtime wiring

## Marker

`COMPETITION_ENGINE_END_TO_END_CERTIFICATION` — `wiredToProductionRuntime: false`, `ownsEngines: false`
