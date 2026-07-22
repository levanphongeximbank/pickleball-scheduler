# CORE-14 Phase 1A-R — Remediation Acceptance

**Module:** Competition Engine — Resource Conflict Resolver (CORE-14)
**Phase:** 1A-R — Remediation (Owner-approved)
**Prerequisite:** [00_PHASE_1A_AUDIT.md](./00_PHASE_1A_AUDIT.md)
**Owner authorization:** `AUTHORIZE_CORE_14_PHASE_1B_CONTRACT_FREEZE_DOCS_ONLY`
**Status:** Documentation freeze artifact only
**Date:** 2026-07-22

---

## 1. Purpose

Record remediations accepted after Phase 1A that must be frozen in Phase 1B contracts before any Phase 1C implementation.

---

## 2. Accepted remediations

| ID | Remediation | Frozen in |
|----|-------------|-----------|
| R1 | Separate `evaluationStatus` from `planStatus`; ban overloaded single `ok` | [08_DETECTION_REQUEST_RESULT.md](./08_DETECTION_REQUEST_RESULT.md) |
| R2 | `CanonicalResourceKey` excludes time; occupancy carries intervals | [02_CANONICAL_RESOURCE_KEY.md](./02_CANONICAL_RESOURCE_KEY.md), [03_RESOURCE_OCCUPANCY.md](./03_RESOURCE_OCCUPANCY.md) |
| R3 | Domain time = `Number.isSafeInteger` epoch ms only; adapters own ISO/slot/timezone | [04_CANONICAL_TIME_MODEL.md](./04_CANONICAL_TIME_MODEL.md) |
| R4 | Half-open `[startMs, endMs)`; adjacent intervals do not conflict | [04_CANONICAL_TIME_MODEL.md](./04_CANONICAL_TIME_MODEL.md) |
| R5 | Single finding catalog; no generic+specialized duplicate emission | [05_RESOURCE_FINDING_CATALOG.md](./05_RESOURCE_FINDING_CATALOG.md) |
| R6 | Input diagnostics ≠ resource conflicts; external schedule diagnostics remain external | [06_DIAGNOSTIC_CATALOG.md](./06_DIAGNOSTIC_CATALOG.md) |
| R7 | HARD minimums immutable downward; emit `SEVERITY_DOWNGRADE_REJECTED` | [07_SEVERITY_POLICY.md](./07_SEVERITY_POLICY.md) |
| R8 | Venue capacity/unavailable specialized codes; same venueId alone is not a conflict | [05_RESOURCE_FINDING_CATALOG.md](./05_RESOURCE_FINDING_CATALOG.md), [07_SEVERITY_POLICY.md](./07_SEVERITY_POLICY.md) |
| R9 | Availability port modes `AUTHORITATIVE` / `ADVISORY`; no Venue & Court internals | [11_AVAILABILITY_PORT.md](./11_AVAILABILITY_PORT.md) |
| R10 | Recommendations are deltas only; dry-run must not mutate caller input | [09_RESOLUTION_RECOMMENDATION.md](./09_RESOLUTION_RECOMMENDATION.md), [10_RESOLUTION_VALIDATION.md](./10_RESOLUTION_VALIDATION.md) |
| R11 | Deterministic IDs/fingerprints; SHA-256 over UTF-8 canonical serialization | [13_DETERMINISM_AND_FINGERPRINT.md](./13_DETERMINISM_AND_FINGERPRINT.md) |
| R12 | Cross-core consume/project boundaries only; no unfinished adjacent imports | [12_INTEGRATION_BOUNDARIES.md](./12_INTEGRATION_BOUNDARIES.md) |

### Phase 1B-S remediations (pre-Phase-1C gates)

| ID | Remediation | Frozen in |
|----|-------------|-----------|
| S1 | Safe-integer epoch ms; reject NaN/Infinity/fractional/string numbers | [04_CANONICAL_TIME_MODEL.md](./04_CANONICAL_TIME_MODEL.md) |
| S2 | Distinct `DUPLICATE_OCCUPANCY_ID` vs `DUPLICATE_ASSIGNMENT` with precedence | [06_DIAGNOSTIC_CATALOG.md](./06_DIAGNOSTIC_CATALOG.md) |
| S3 | Always-required occupancy fields + `ACTIVITY_IDENTITY_MISSING` | [03_RESOURCE_OCCUPANCY.md](./03_RESOURCE_OCCUPANCY.md) |
| S4 | UTF-8 bytewise canonicalize; no silent identity transform; no whitespace | [13_DETERMINISM_AND_FINGERPRINT.md](./13_DETERMINISM_AND_FINGERPRINT.md) |
| S5 | Advisory unknown → `VALID_WITH_WARNINGS` + `availabilityCertification=PARTIAL` | [08_DETECTION_REQUEST_RESULT.md](./08_DETECTION_REQUEST_RESULT.md), [11_AVAILABILITY_PORT.md](./11_AVAILABILITY_PORT.md) |

---

## 3. Authorization constraints (binding)

Phase 1B **may**:

- create documentation under `docs/competition-engine/core-14/` only

Phase 1B **must not**:

- implement runtime source code
- create files under `src/features/competition-core/resource-conflict/`
- modify scheduling, tournament, venue, court, referee, player, team, or optimizer modules
- wire production paths
- modify SQL
- run deployment
- commit, push, or open a Pull Request

---

## 4. Exit to Phase 1B

All remediations above are accepted as contract-design requirements.

Phase 1B produces the numbered contract freeze set `01`–`14` under this directory.
