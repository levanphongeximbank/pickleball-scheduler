# E2E-07 — Certification Scope

## In scope (local MVP)

- Structural export/markers/architecture ban scan
- IND Pool+Knockout 27-step happy path (organizer + player + referee + public + governance readiness)
- Fail-closed matrix (tenant, check-in, schedule/court, scoring, qualification, publication, governance)
- Recovery/replay readiness via governance facade handoffs
- Public privacy (unpublished hidden, forbidden keys stripped, realtime disabled)
- Governance health READY/BLOCKED/degraded safe partial
- Suspension/resume + archive readiness gates
- GOV-08 local benchmark (sizes 8/16/32)
- E2E-00 capability traceability (59 codes)

## Out of scope

- Parallel standings/scoring/validation/workflow engines
- Remote staging/production execution
- OPS-11 incident product, EXP-07/08/09, non-IND templates/formats
- Platform Governance product duplication

## Verdicts

| Verdict | Meaning |
|---------|---------|
| `CERTIFIED_LOCAL_MVP` | All local harness checks pass |
| `BLOCKED` | Mandatory local check failed |
| `DEGRADED` | Partial with deferred remote |
| `CERTIFIED_STAGING` / `PRODUCTION_READY` | Requires remote evidence (not claimed locally) |
