# E2E-06 — Governance & Reliability Runtime

**Workstream:** Competition End-to-End — Governance & Reliability  
**Vertical slice:** INDIVIDUAL TOURNAMENT — POOL + KNOCKOUT  
**Base:** `b184b89636443a57e556b4ac48c0483748e34485`  
**Branch:** `feature/competition-e2e-06-governance-reliability-runtime`

## Goal

Provide a competition-scoped governance & reliability runtime that orchestrates readiness, fail-closed gates, evidence manifests, and handoffs across Organizer → Player → Referee → Public → Completion → Archive → Recovery/Resume → Audit → Certification readiness.

## Owns (E2E-00 capability IDs)

| ID | Name | E2E-06 outcome |
|----|------|----------------|
| GOV-01 | Rule Versioning | Definition/ruleSetVersion projected in governance state |
| GOV-02 | Competition Audit & Event Log | Evidence manifest + CORE-20 handoff (no new storage) |
| GOV-03 | Deterministic Seed & Replay | Replay readiness via CORE-21 |
| GOV-04 | Data Validation | Scoring/result-validation readiness gates |
| GOV-05 | Import / Export Governance | Import/export readiness via CORE-22 |
| GOV-06 | Recovery & Resume | Recovery readiness via CORE-23 + CORE-19 handoff |
| GOV-07 | Observability & Monitoring | Decision/health explanation traces (minimum) |
| GOV-09 | Security & Permission Enforcement | E2E-01 Identity + CORE-02 fail-closed |
| GOV-10 | Tenant / Venue Isolation | Explicit tenant/competition scope checks |
| OPS-12 | Protest & Dispute | MVP: dispute-reset only; formal protest DEFERRED |

## Does not own

- Platform-wide incident management (Platform Governance & Operations)
- Platform APM / remote log storage
- Global auth taxonomy / secrets / SQL / deployment
- Competition Core algorithms
- Parallel workflow/audit/replay/import-export/recovery engines

## Canonical facade

`createCompetitionGovernanceReliabilityFacade`

Methods: `getGovernanceState`, `evaluateOperationReadiness`, `evaluatePublicationReadiness`, `evaluateCompletionReadiness`, `evaluateArchiveReadiness`, `evaluateRecoveryReadiness`, `evaluateReplayReadiness`, `evaluateImportReadiness`, `evaluateExportReadiness`, `buildReliabilityEvidence`, `createIncidentProjection`, `createDegradedModeProjection`, `createCertificationReadinessProjection`.

## Docs index

| File | Purpose |
|------|---------|
| `00_FILE_OWNERSHIP.md` | Ownership lock |
| `01_CANONICAL_INPUTS.md` | Consumed public surfaces |
| `02_GOVERNANCE_CONTRACT.md` | Facade/projection contract |
| `03_RELIABILITY_POLICY.md` | Policy + health states |
| `04_AUDIT_EVIDENCE_MODEL.md` | Evidence manifest |
| `05_REPLAY_IMPORT_EXPORT.md` | Replay + import/export gates |
| `06_RECOVERY_RESUME.md` | Recovery readiness |
| `07_PERMISSION_TENANT_MATRIX.md` | Authz matrix |
| `08_LEGACY_REUSE_MAP.md` | Legacy inventory |
| `09_BLOCKER_RESOLUTION.md` | Blockers / deferred |
| `10_TEST_EVIDENCE.md` | Test evidence |
| `11_E2E_07_READINESS.md` | Handoff to certification |

## Marker

Implementation complete when committed/pushed/PR ready:

`E2E_06_IMPLEMENTED_COMMITTED_PUSHED_PR_READY`
