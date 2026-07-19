# Official Manifest — Phase 3B Integrator Wave 1

## Option D

Capability sub-manifest:

```text
scripts/ci/unit-test-files.phase-3b.json
```

Integrator Wave 1 also ships:

```text
scripts/ci/unit-test-files.phase-3b-wave1.json
```

Official SSOT:

```text
scripts/ci/unit-test-files.json
```

## Integrated paths

```text
tests/competition-core-participant-runtime-3b.test.js
tests/competition-core-participant-runtime-3b-architecture.test.js
tests/competition-core-participant-integrator-3b-wave1.test.js
```

Inserted after Phase 3A.3 registry architecture tests. Each path appears exactly once.

## Validator

```powershell
node scripts/ci/validate-phase-test-manifests.mjs
```

Must PASS after Wave 1 (phase sub-manifest entries ⊆ official).
