# PROD-OPS-30D-01 — Incident and Anomaly Register

Severity: `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`  
Stop conditions (immediate report): cross-tenant exposure; unauthorized admin; repeated 500s; login outage; catalog metadata exposure; failed backup; unknown deploy; secret exposure — **none triggered**.

| ID | Date/time (UTC) | Observation | Affected | Severity | Evidence | Impact | Repetition | State | Owner | Containment | Closure criteria | Continuation impact |
|----|-----------------|-------------|----------|----------|----------|--------|------------|-------|-------|-------------|------------------|---------------------|
| A-CAL-01 | ongoing | Seven-calendar-day route series incomplete (1 VERIFIED UTC day) | Daily continuity | LOW | `02_*` | Incomplete A-CAL closure | ongoing | **OPEN** | Ops | Continue cadence | 7 VERIFIED calendar days | Continue constrained |
| A-ENV-01 | carry-forward | Full Vercel Production env inventory unreadable | Config trust | MEDIUM | CLI unlinked | Inventory blind spot | ongoing | OPEN | Owner | Redacted inventory | Inventory reviewed | Continue |
| A-MONITOR-01 | 2026-07-27T23:32Z | Monitoring only partially effective | IR detectability | MEDIUM | `04_*` | Limited automation | ongoing | OPEN | Ops | Smoke cadence | IR SSOT PASS | Continue with controls |
| A-AUTH-01 | carry-forward | Interactive login not fully exercised | Auth | LOW | `05_*` | Session path unproven live | ongoing | OPEN | Owner | Provide safe account or accept | Exercised **or** written accept | Continue |
| A-PITR-01 | carry-forward | PITR NOT_ENABLED | Recovery | MEDIUM | Gate 8 | RPO gap | ongoing | ACCEPTED | Owner | Keep visible | PITR **or** permanent accept | Accepted |
| A-STORAGE-01 | carry-forward | Storage recovery GAP | Media recovery | MEDIUM | Gate 8 | Objects outside DB backup | ongoing | ACCEPTED | Owner | Plan or accept | Storage plan verified | Accepted |
| A-DRILL02-01 | carry-forward | Restore drill 02 DEFERRED | Recoverability | MEDIUM | `07_*` | Latest schema/RLS restore unproven | ongoing | DEFERRED | Owner | Authorize separate drill | Drill 02 evidence | Accepted |
| A-SCHEMA-01 | carry-forward | Latest schema recoverability NOT_VERIFIED | Catalog rollback | MEDIUM | Gate 8 | Uncertainty | ongoing | OPEN | Owner | Drill 02 | Verified restore | Accepted |
| A-RLS-REC-01 | carry-forward | Latest Clubs RLS recoverability NOT_VERIFIED | Isolation restore | MEDIUM | Gate 8 | Policy restore uncertainty | ongoing | OPEN | Security | Drill 02 | Policies restore proven | Accepted |
| A-EMPTY-01 | 2026-07-27T23:32Z | Tournaments/Rankings LIVE_EMPTY | Catalog honesty | LOW | RPC/routes | No populate claim | ongoing | OPEN | Portal | Honest-empty | Certified publish | Continue |
| A-GA-01 | carry-forward | Whole-platform GA NOT_APPROVED | Messaging | HIGH | Gate 10 | GA marketing forbidden | ongoing | OPEN | Owner | Keep NOT_APPROVED | Separate program | Constrained only |
| A-SCOPE-CE | carry-forward | Competition Engine full rollout NOT_APPROVED | Scope | MEDIUM | Gate 10 | Excluded | ongoing | OPEN | Owner | Keep | Separate cert | Excluded |
| A-SCOPE-BM | carry-forward | Business Modules full rollout NOT_APPROVED | Scope | MEDIUM | Gate 10 | Excluded | ongoing | OPEN | Owner | Keep | Separate cert | Excluded |
| A-SCOPE-IA | carry-forward | Intelligence & Analytics full rollout NOT_APPROVED | Scope | MEDIUM | Gate 10 | Excluded | ongoing | OPEN | Owner | Keep | Separate cert | Excluded |
| A-ECO-01 | carry-forward | Ecosystem live NOT_APPROVED | Ecosystem | MEDIUM | Gate 10 | Excluded | ongoing | OPEN | Integrations | Keep | Provider smoke | Excluded |
| A-IOS-01 | carry-forward | iOS App Store NOT_APPROVED | Mobile | LOW | Gate 10 | Excluded | ongoing | OPEN | Mobile | Keep | Store package | Excluded |
| A-ANDROID-01 | carry-forward | Android Play Store NOT_APPROVED | Mobile | LOW | Gate 10 | Excluded | ongoing | OPEN | Mobile | Keep | Store package | Excluded |

```text
NEW_CRITICAL=NONE
NEW_HIGH=NONE
STOP_CONDITION_TRIGGERED=NONE
```

## Marker

`PROD_OPS_30D_01_INCIDENT_AND_ANOMALY_REGISTER_RECORDED`
