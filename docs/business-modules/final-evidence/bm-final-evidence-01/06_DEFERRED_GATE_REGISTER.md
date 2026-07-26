# Deferred Gate Register

## Marker

`BUSINESS_MODULES_DEFERRED_GATES_REGISTERED`

## Rule

**`deferredGate != implementationGap`**

Modules may be implementation-closed while Production/remote/provider/UI gates remain deferred.

## Gates (summary)

| ID | Module | Status | Impl closure impact | DB | Prod | Owner later |
|----|--------|--------|---------------------|----|------|-------------|
| NEWS_PRODUCTION_ROLLOUT | News | GO_WITH_CONDITIONS / ABSENT | NONE | Y | Y | Separate apply GO |
| REPORTING_PRODUCTION_ROLLOUT | Reporting | READY_WITH_PRECONDITIONS / not performed | NONE | Y | Y | Separate rollout |
| COACHING_PRODUCTION_ROLLOUT | Coaching | NOT_PERFORMED | NONE | Y | Y | Separate runtime |
| REMOTE_STAGING_RECONFIRMATION | News/Coaching/Reporting | Historical cert accepted | NONE | Y | N | Optional reconfirm |
| CUSTOMER_EXTERNAL_DIRECTORY_PROVIDER | Customer | Formally parked | NONE for prior phases | Y | N | Start or keep park |
| UI_PRODUCT_EXPANSION | cross | Documented exclusions | NONE | N | N | Product waves |
| REAL_CREDENTIALS_PROVIDER_ACTIVATION | cross | Not in B1 | NONE | N | Y | Owner secrets |
| OPERATIONAL_RELEASE | Competition/TT | Protected residuals | Out of scope | Y | Y | Release Owner |
| DEPLOYMENT_MIGRATION_APPLICATION | SQL packages | Authored, not Prod-applied | NONE | Y | Y | Apply order GO |
| COMPETITION_RELEASE_PRODUCTION_WORKTREES | Competition | Classified not cleaned | Out of scope | N | N | Cleanup wave |

Canonical machine-readable detail: `06_DEFERRED_GATE_REGISTER.json`.
