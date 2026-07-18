# Test Sub-manifest Convention — Phase 3A.3 (Option D)

## Files

```text
scripts/ci/unit-test-files.json                 # official SSOT (Integrator)
scripts/ci/unit-test-files.phase-3a3.json       # phase contractual list
scripts/ci/unit-test-files.phase-3b.json        # future capability chats
```

## Runner

`scripts/ci/run-unit-tests.mjs` still reads **only** the official manifest (backward compatible).  
Sub-manifests are **not** auto-loaded by the runner (avoids rewrite / accidental double-run).

## Integrator duty

1. Capability PR ships `unit-test-files.phase-3x.json` + tests.
2. Integrator appends those paths into `unit-test-files.json`.
3. Validate:

```powershell
node scripts/ci/validate-phase-test-manifests.mjs
```

## Capability chat duty

- **MUST NOT** edit `unit-test-files.json`
- **MAY** create/update own `unit-test-files.phase-3x.json`
