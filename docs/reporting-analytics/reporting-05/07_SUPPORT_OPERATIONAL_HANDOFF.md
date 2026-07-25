# REPORTING-05 — Support & Operational Handoff

## Module contacts (product)

| Role | Responsibility |
|------|----------------|
| Product Owner | Closure acceptance, Production GO/NO-GO, role-permission matrix |
| Reporting module maintainer | Facade, durable adapters, presentation honesty, docs |
| I&A owner | Projection execute-by-id public contract + deploy |
| Identity owner | Optional `role_permissions` assignment for `reporting.*` |
| Platform / ops | Staging/Production apply, backup retention, monitoring |

## Runtime symptoms → expected honest states

| Symptom | Expected UI / API state |
|---------|-------------------------|
| No composition-root inject | `/reports` UNAVAILABLE |
| I&A projection not deployed | Execution UNAVAILABLE + `PROJECTION_SOURCE_NOT_DEPLOYED` |
| Live dashboard empty club data | EMPTY (not mock KPIs) |
| Live dashboard fetch failure | ERROR + retry (not mock) |
| Explicit demo/preview mode | MOCK / PREVIEW only |
| Export without valid output ref | no success link; not SUCCEEDED presentation |
| Version conflict on save | typed conflict / VERSION_CONFLICT |

## Rollback / backup retention

| Asset | Note |
|-------|------|
| Staging backup SHA256 | `5fd399ce0c23ed414725ee13510c41a1ab1ab120a2f301d03897e54dc36dc050` |
| Schema rollback SQL | `docs/reporting-analytics/reporting-02/90_REPORTING_02_ROLLBACK.sql` |
| Permission catalog rollback | `91_REPORTING_02_PERMISSION_SEED_ROLLBACK.sql` (refuses if mappings remain) |
| REPORTING-03 rollback | **Do not** execute without Owner GO; REPORTING-05 does not rollback |

Retain the Staging backup until Owner explicitly authorizes disposal after Production strategy is decided.

## Forbidden support actions

- Apply Production SQL without Owner GO
- Add browser service-role keys
- Map `reporting.*` to roles without Owner decision
- “Fix” UNAVAILABLE by loading mock under LIVE
- Store durable Reporting state in localStorage

## Doc index

- Final certification: `01_FINAL_CERTIFICATION_REPORT.md`
- Module closure: `02_BUSINESS_MODULE_2_10_CLOSURE.md`
- Inventory: `03_CAPABILITY_INVENTORY.md`
- Ownership: `04_OWNERSHIP_BOUNDARY.md`
- Staging security summary: `05_STAGING_SECURITY_EVIDENCE.md`
- Residuals / Production readiness: `06_ACCEPTED_RESIDUALS_AND_PRODUCTION_READINESS.md`
