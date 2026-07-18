# Phase 3A.3 — Integration Bootstrap

```text
Wave 0 = PHASE 3A.3 — INTEGRATION BOOTSTRAP
Owner chat: CHAT I (Integrator)
Branch: feature/competition-engine-phase-3a3-integration-bootstrap
Status: REQUIRED before Phase 3B
```

## Purpose

Minimal integration infrastructure so capability phases **3B–3L** can implement independently without editing shared barrels.

## Implemented now

| Deliverable | Location |
|-------------|----------|
| Capability / executor registry (factory + singleton) | `runtime-control/registries/` |
| Comparator registry | `runtime-control/shadow/registries/comparators.js` |
| Normalizer registry | `runtime-control/shadow/registries/normalizers.js` |
| Eligibility allowlist registry | `runtime-control/shadow/registries/eligibilityAllowlists.js` |
| Registry reason codes | `runtime-control/registries/registryReasonCodes.js` |
| Shared-file ownership guard | `scripts/ci/competition-shared-file-ownership.mjs` |
| Phase sub-manifest validator | `scripts/ci/validate-phase-test-manifests.mjs` |
| Phase 3A.3 sub-manifest | `scripts/ci/unit-test-files.phase-3a3.json` |
| Official manifest merge (3a3 tests) | `scripts/ci/unit-test-files.json` |
| Unit + architecture tests | `tests/competition-core-runtime-registry-3a3*.test.js` |

## Reserved for future capability phases

- Capability business executors / adapters
- Comparator & normalizer **implementations**
- Wiring registries into `resolveShadowEligibility` / runtime dispatch
- `RUNTIME_EXECUTOR.CANONICAL`

## Not implemented / Forbidden

```text
No Production request-path change
No feature-flag enablement
No Shadow enablement
No canonical invocation
No DB migration
No Phase 3B capability runtime
```

## Document index

| File | Topic |
|------|-------|
| [implementation-summary.md](./implementation-summary.md) | What shipped |
| [registry-architecture.md](./registry-architecture.md) | Overall design |
| [capability-registry-contract.md](./capability-registry-contract.md) | Capability/executor API |
| [comparator-registry-contract.md](./comparator-registry-contract.md) | Comparator API |
| [normalizer-registry-contract.md](./normalizer-registry-contract.md) | Normalizer API |
| [eligibility-registry-contract.md](./eligibility-registry-contract.md) | Eligibility allowlist API |
| [runtime-registry-decision.md](./runtime-registry-decision.md) | Why no separate adapter registry |
| [public-export-convention.md](./public-export-convention.md) | Option B |
| [test-submanifest-convention.md](./test-submanifest-convention.md) | Option D |
| [shared-file-ownership-guard.md](./shared-file-ownership-guard.md) | CI guard usage |
| [production-safety-report.md](./production-safety-report.md) | Safety evidence |
| [validation-report.md](./validation-report.md) | Command results |
| [phase-3b-entry-criteria.md](./phase-3b-entry-criteria.md) | Gate to Chat 1 |
| [owner-review-checklist.md](./owner-review-checklist.md) | Owner GO |
| [safety-invariants.md](./safety-invariants.md) | Invariants |
| [registration-api.md](./registration-api.md) | Quick Integrator API |

## Related

- Phase 3P governance: `docs/competition-engine/phase-3p/`
- Phase 3A.1 / 3A.2: `docs/competition-engine/phase-3a1/`, `phase-3a2/`
