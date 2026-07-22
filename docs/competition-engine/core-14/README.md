# CORE-14 — Resource Conflict Resolver

**Module:** Competition Engine — Resource Conflict Resolver
**Branch:** `feature/competition-core-14-resource-conflict-resolver`
**Phase:** **1G — Final Certification, Controlled Commit and Push**
**Date:** 2026-07-22
**Status:** Phase 1C–1F dormant foundation certified; module remains dormant and unwired; Phase 1G authorizes controlled branch commit/push only (no PR / merge / deploy)
**Owner verdict (prior):** `CORE_14_PHASE_1F_APPROVED`
**Phase 1G authorization:** `AUTHORIZE_CORE_14_PHASE_1G_FINAL_CERTIFICATION_COMMIT_AND_PUSH`

Owner authorizations:

- `CORE_14_PHASE_1A_APPROVED`
- `AUTHORIZE_CORE_14_PHASE_1B_CONTRACT_FREEZE_DOCS_ONLY`
- `CORE_14_PHASE_1B_APPROVED`
- `AUTHORIZE_CORE_14_PHASE_1C_DORMANT_DOMAIN_FOUNDATION`
- `CORE_14_PHASE_1C_APPROVED`
- `AUTHORIZE_CORE_14_PHASE_1C_S_SAFE_SYNC_AND_DOMAIN_CERTIFICATION`
- `AUTHORIZE_CORE_14_PHASE_1D_DORMANT_CONFLICT_DETECTORS`
- `AUTHORIZE_CORE_14_PHASE_1E_DORMANT_RESOLUTION_RECOMMENDATIONS_AND_VALIDATION`
- `AUTHORIZE_CORE_14_PHASE_1F_DORMANT_ADAPTERS_AND_SHADOW_PARITY`
- `CORE_14_PHASE_1F_APPROVED`
- `AUTHORIZE_CORE_14_PHASE_1G_FINAL_CERTIFICATION_COMMIT_AND_PUSH`

---

## Purpose

CORE-14 owns resource conflict **detection**, **classification**, deterministic local **resolution recommendations**, **dry-run validation**, capability-local **adapters/projectors**, and diagnostic **shadow parity**.

CORE-14 does **not** own match/schedule/court/referee generation, inventory, availability source of truth, persistence, UI, workflow, notifications, deployment, or global optimization.

**Certification scope:** DORMANT DOMAIN, DETECTORS, RESOLUTION, ADAPTERS, PROJECTORS, AND SHADOW PARITY READY FOR INTEGRATOR REVIEW.

---

## Document index

| Doc | Topic |
|-----|-------|
| [00_PHASE_1A_AUDIT.md](./00_PHASE_1A_AUDIT.md) | Phase 1A audit baseline |
| [00B_PHASE_1A_R_REMEDIATION.md](./00B_PHASE_1A_R_REMEDIATION.md) | Accepted remediations + 1B-S gates |
| [01_OWNERSHIP_BOUNDARY.md](./01_OWNERSHIP_BOUNDARY.md) | Ownership map |
| [02_CANONICAL_RESOURCE_KEY.md](./02_CANONICAL_RESOURCE_KEY.md) | CanonicalResourceKey |
| [03_RESOURCE_OCCUPANCY.md](./03_RESOURCE_OCCUPANCY.md) | ResourceOccupancy + requiredness |
| [04_CANONICAL_TIME_MODEL.md](./04_CANONICAL_TIME_MODEL.md) | Safe-integer epoch ms + half-open intervals |
| [05_RESOURCE_FINDING_CATALOG.md](./05_RESOURCE_FINDING_CATALOG.md) | Finding codes |
| [06_DIAGNOSTIC_CATALOG.md](./06_DIAGNOSTIC_CATALOG.md) | Input + external diagnostics |
| [07_SEVERITY_POLICY.md](./07_SEVERITY_POLICY.md) | HARD/SOFT + capacity + mode-dependent availability minima |
| [08_DETECTION_REQUEST_RESULT.md](./08_DETECTION_REQUEST_RESULT.md) | Request/result statuses |
| [09_RESOLUTION_RECOMMENDATION.md](./09_RESOLUTION_RECOMMENDATION.md) | Recommendation deltas |
| [10_RESOLUTION_VALIDATION.md](./10_RESOLUTION_VALIDATION.md) | Dry-run validation |
| [11_AVAILABILITY_PORT.md](./11_AVAILABILITY_PORT.md) | Availability port |
| [12_INTEGRATION_BOUNDARIES.md](./12_INTEGRATION_BOUNDARIES.md) | Cross-core boundaries |
| [13_DETERMINISM_AND_FINGERPRINT.md](./13_DETERMINISM_AND_FINGERPRINT.md) | UTF-8 canonicalize / SHA-256 |
| [14_PHASE_1C_IMPLEMENTATION_PLAN.md](./14_PHASE_1C_IMPLEMENTATION_PLAN.md) | Phase 1C plan + test matrix |
| [15_PHASE_1C_FINAL_CONTRACT_CORRECTIONS.md](./15_PHASE_1C_FINAL_CONTRACT_CORRECTIONS.md) | Owner final Phase 1C contract corrections |
| [16_PHASE_1C_S_SAFE_SYNC_AND_DOMAIN_CERTIFICATION.md](./16_PHASE_1C_S_SAFE_SYNC_AND_DOMAIN_CERTIFICATION.md) | Phase 1C-S sync + domain certification |
| [17_PHASE_1D_DORMANT_CONFLICT_DETECTORS.md](./17_PHASE_1D_DORMANT_CONFLICT_DETECTORS.md) | Phase 1D detectors, suppression, status derivation |
| [18_PHASE_1E_DORMANT_RESOLUTION_RECOMMENDATIONS.md](./18_PHASE_1E_DORMANT_RESOLUTION_RECOMMENDATIONS.md) | Phase 1E recommendations, projection, validation, ranking |
| [19_PHASE_1F_DORMANT_ADAPTERS_AND_SHADOW_PARITY.md](./19_PHASE_1F_DORMANT_ADAPTERS_AND_SHADOW_PARITY.md) | Phase 1F adapters, projectors, legacy mapping, shadow parity |
| [20_PHASE_1G_FINAL_CERTIFICATION.md](./20_PHASE_1G_FINAL_CERTIFICATION.md) | Phase 1G final certification + controlled commit/push |

---

## Phase 1G status

- Phase 1C–1F dormant work preserved and certified
- Capability-local only; no root export; no production wiring
- Controlled commit + push of feature branch only; **no PR / merge / deploy** in this phase

Authorized paths:

- `docs/competition-engine/core-14/`
- `src/features/competition-core/resource-conflict/`
- `tests/competition-core-resource-conflict-core14-phase1c.test.js`
- `tests/competition-core-resource-conflict-core14-phase1d.test.js`
- `tests/competition-core-resource-conflict-core14-phase1e.test.js`
- `tests/competition-core-resource-conflict-core14-phase1f.test.js`
