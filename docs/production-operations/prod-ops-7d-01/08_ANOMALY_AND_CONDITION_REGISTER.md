# PROD-OPS-7D-01 — Anomaly and Condition Register

Severity: `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`

No new CRITICAL production-continuity blockers observed in this 7D control package.

| ID | Observation | Date/time (UTC) | Affected control | Severity | Evidence | Impact | Owner | Immediate action | Closure criteria | Production continuation impact |
|----|-------------|-----------------|------------------|----------|----------|----------|--------|------------------|------------------|--------------------------------|
| A-ENV-01 | Full Vercel Production env values / redacted inventory still unreadable via linked CLI | 2026-07-27T22:59Z | Production config trust (`RC-ENV-01`) | MEDIUM | Vercel CLI unlinked; Gate 8–10 carry-forward | Blind spot on complete live config inventory | Owner/Platform | Deliver redacted env inventory (names/presence only) | Inventory reviewed | Continues constrained; does not force pause |
| A-RBAC-01 | Prior NOT_VERIFIED effective RBAC — **updated** | 2026-07-27T22:59Z | Auth/RBAC (`RC-RBAC-01`) | LOW (downgraded from MEDIUM) | Bundle diagnostic classification `VERIFIED_ENABLED`; value not printed | Effective RBAC for constrained web now evidenced | Owner | Keep classification visible; still no secret print | Remains VERIFIED_ENABLED on tip or Owner reconfirm after env change | Improves confidence; continue |
| A-MONITOR-01 | Automated monitoring/IR effectiveness not independently verified | 2026-07-27T22:59Z | Incident detectability (`RC-MONITOR-01`) | MEDIUM | Manual smoke PASS; dashboards unread | Limited automated detectability | Ops/Owner | Continue smoke cadence; file dashboard gap note | IR monitoring SSOT PASS | Continue with additional manual controls |
| A-TRACE-01 | Gate 1–7 packages still NOT_RECORDED; `B-AUDIT-TRACEABILITY-01=PARTIALLY_RESOLVED` | carry-forward | Audit lineage | HIGH | Gate 9/10 docs | Cannot claim full historical audit package closure | Audit/Owner | Keep PARTIALLY_RESOLVED | Packages on main **or** Owner waiver | Blocks whole-platform GA marketing only |
| A-PITR-01 | PITR not enabled | carry-forward | Recovery / RPO | MEDIUM | Gate 8 recovery register | Point-in-time restore gap | Owner | Keep accepted; do not silent-close | PITR enable **or** permanent accept remains visible | Accepted residual |
| A-STORAGE-01 | Storage objects not in DB backups | carry-forward | Media/object recovery | MEDIUM | Gate 8 | Object loss outside DB backup | Owner | Outline Storage plan or reaffirm accept | Storage backup plan verified | Accepted residual |
| A-DRILL02-01 | Restore drill 02 deferred | carry-forward | Latest schema + Clubs RLS recoverability | MEDIUM | Gate 8/10 | Confidence limited to drill 01 historical | Owner | Keep DEFERRED | Drill 02 evidence complete | Accepted residual |
| A-SCHEMA-01 | Latest Public Catalog schema recoverability not verified | carry-forward | Catalog rollback confidence | MEDIUM | `LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED` | Catalog schema restore uncertainty | Owner/Portal | Keep visible | Verified restore of latest catalog schema | Accepted residual |
| A-RLS-REC-01 | Latest Clubs RLS remediation recoverability not verified on drill | carry-forward | Clubs tenant isolation restore | MEDIUM | Recovery register | Policy-state restore uncertainty | Security/Owner | Keep visible; include policies in drill 02 | Drill proves remediated policy set restores | Accepted residual |
| A-EMPTY-01 | Tournaments and Rankings remain LIVE_EMPTY | 2026-07-27T22:59Z | Public Catalog honesty | LOW | Route 200 + certified empty posture | No populated tournament/ranking GA claim | Portal | Keep honest-empty | Certified populated publish | Continue constrained |
| A-ECO-01 | Ecosystem live activation not approved | carry-forward | Ecosystem scope | MEDIUM | Gate 10 | No live third-party integration | Integrations | Keep NOT_APPROVED | Provider + webhook smoke certified | Excluded |
| A-MOBILE-STORE-01 | iOS/Android store release not approved | carry-forward | Mobile store | LOW | Gate 10 | Web PWA ≠ store release | Mobile | Keep NOT_APPROVED | Store evidence package | Excluded |
| A-GA-01 | Whole-platform GA not approved | carry-forward | Release messaging | HIGH | Gate 10 closure | Marketing/GA claims forbidden | Owner | Keep NOT_APPROVED | Separate whole-platform program | Constrained only |
| A-IR-ROSTER-01 | Live incident contact roster not in-repo | carry-forward | Incident comms | LOW | `RC-IR-ROSTER-01` | Possible comms delay | Owner | Acknowledge offline OK or record roster | Roster recorded or accept | FOLLOW_UP |
| A-CAL-01 | Seven calendar-day daily checkpoint series incomplete at authorship | 2026-07-27T22:59Z | Daily continuity series | LOW | `04_DAILY_CONTINUITY_CHECKS.md` | Remaining days rely on 30d cadence | Ops | Execute remaining daily smokes | Seven dated daily rows complete **or** Owner accepts observed-window continuity | Continue; observation only |

## New anomalies this workstream

```text
NEW_CRITICAL=NONE
NEW_HIGH=NONE
NEW_MEDIUM_BEYOND_KNOWN_CONDITIONS=NONE
A-RBAC-01_STATUS=UPDATED_TO_VERIFIED_ENABLED
A-CAL-01=NEW_LOW_OBSERVATION
```

## Production continuation impact summary

| Severity present | Continuation impact |
|------------------|---------------------|
| CRITICAL | none open |
| HIGH | Traceability + whole-platform GA marketing only — **does not** require pause of constrained web |
| MEDIUM | Recovery gaps + monitoring automated gap + env inventory — continue constrained with controls |
| LOW | Calendar series incompleteness + LIVE_EMPTY + store/IR roster |

## Marker

`PROD_OPS_7D_01_ANOMALY_AND_CONDITION_REGISTER_RECORDED`
