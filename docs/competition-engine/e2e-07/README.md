# E2E-07 — End-to-End Certification (IND Pool+Knockout)

**Workstream:** `feature/competition-e2e-07-end-to-end-certification`  
**Version:** `e2e-07-end-to-end-certification-v1`  
**Scope:** Orchestration/certification only — reuses E2E-01..06 public barrels; no parallel engines.

## What this workstream owns

- Full vertical certification harness (`createCompetitionEndToEndCertificationHarness`)
- GOV-08 MVP local performance benchmark gate
- Deterministic evidence pack under `evidence/`
- Capability traceability against E2E-00 register (59 codes)
- Presentation view-model (`buildCertificationSections`)

## Local verdict (harness)

Running `runCompetitionEndToEndCertification()` yields **`CERTIFIED_LOCAL_MVP`** when all local checks pass. Remote staging/production evidence remains **DEFERRED** (`E2E_07_REMOTE_STAGING_OWNER_GO_REQUIRED`).

## Docs index

| Doc | Purpose |
|-----|---------|
| [00_FILE_OWNERSHIP.md](./00_FILE_OWNERSHIP.md) | Ownership boundaries |
| [01_CERTIFICATION_SCOPE.md](./01_CERTIFICATION_SCOPE.md) | In/out of scope |
| [02_CAPABILITY_TRACEABILITY.md](./02_CAPABILITY_TRACEABILITY.md) | E2E-00 mapping |
| [03_VERTICAL_HAPPY_PATH.md](./03_VERTICAL_HAPPY_PATH.md) | 27-step path |
| [04_FAIL_CLOSED_MATRIX.md](./04_FAIL_CLOSED_MATRIX.md) | Fail-closed categories |
| [05_RECOVERY_REPLAY_CERTIFICATION.md](./05_RECOVERY_REPLAY_CERTIFICATION.md) | GOV-03/06 gates |
| [06_PUBLIC_PRIVACY_CERTIFICATION.md](./06_PUBLIC_PRIVACY_CERTIFICATION.md) | EXP privacy |
| [07_GOVERNANCE_CERTIFICATION.md](./07_GOVERNANCE_CERTIFICATION.md) | Health/degraded |
| [08_GOV_08_PERFORMANCE_BENCHMARK.md](./08_GOV_08_PERFORMANCE_BENCHMARK.md) | Local budgets |
| [09_REMOTE_STAGING_CERTIFICATION_RUNBOOK.md](./09_REMOTE_STAGING_CERTIFICATION_RUNBOOK.md) | Deferred remote |
| [10_EVIDENCE_MANIFEST.md](./10_EVIDENCE_MANIFEST.md) | Evidence pack |
| [11_DEFERRED_AND_RESIDUAL_RISKS.md](./11_DEFERRED_AND_RESIDUAL_RISKS.md) | Residual risks |
| [12_FINAL_CLOSURE_READINESS.md](./12_FINAL_CLOSURE_READINESS.md) | Closure checklist |

## Tests

```bash
node --test tests/competition-engine-e2e-07-end-to-end-certification.test.js
node --test tests/competition-engine-e2e-07-gov08-benchmark.test.js
```
