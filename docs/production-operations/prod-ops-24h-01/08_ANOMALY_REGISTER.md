# PROD-OPS-24H-01 — Anomaly Register

Severity: `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`  
No new CRITICAL production-continuity blockers observed in this 24h verification.

| anomaly ID | observation | affected route/control | severity | evidence | current impact | immediate action | owner | release impact | stop condition |
|------------|-------------|------------------------|----------|----------|----------------|------------------|-------|----------------|----------------|
| A-TRACE-01 | Gate 1–7 packages still NOT_RECORDED; `B-AUDIT-TRACEABILITY-01=PARTIALLY_RESOLVED` | Audit lineage honesty | HIGH | Gate 9/10 docs; Gate 10 evidence tests PASS preserving marker | Cannot claim full historical audit package closure | Keep PARTIALLY_RESOLVED; decide reconstruct vs waiver in 7d | Audit/Owner | Blocks whole-platform GA marketing claims | Packages on main **or** Owner waiver |
| A-ENV-01 | Vercel Production env values unreadable to audit | Production config trust (`RC-ENV-01`) | MEDIUM | Gate 8–10; `vercel env` not readable without link/secrets exposure | Blind spot on live config inventory | Deliver redacted env inventory (names/presence) | Owner/Platform | Condition for broader GA | Redacted inventory reviewed |
| A-RBAC-01 | Effective Production `VITE_RBAC_ENABLED` not independently verified | Auth/RBAC (`RC-RBAC-01`) | MEDIUM | Code default PROD=true when unset; env values unread | Effective RBAC posture uncertain | Confirm value or accept code-default risk in writing | Owner | Condition for broader auth GA | Confirmed evidence **or** explicit accept |
| A-MONITOR-01 | Monitoring/observability operational effectiveness not verified | Incident detectability (`RC-MONITOR-01`) | MEDIUM | PGO-02/03; Gate 10 condition register | Limited automated detectability | Manual 24h/7d smoke cadence; dashboard review | Ops/Owner | Blocks Ops-ready GA claims | IR monitoring SSOT PASS |
| A-PITR-01 | PITR not enabled (Owner declined) | Recovery / RPO | MEDIUM | Gate 8 recovery register | Point-in-time restore gap | Keep accepted; do not silent-close | Owner | Accepted residual | PITR enable **or** permanent accept remains visible |
| A-STORAGE-01 | Storage objects not in DB backups | Media/object recovery | MEDIUM | Gate 8 recovery register | Object loss outside DB backup | Outline Storage plan or reaffirm accept | Owner | Accepted residual | Storage backup plan verified |
| A-DRILL02-01 | Restore drill 02 deferred | Latest schema + Clubs RLS recoverability | MEDIUM | Gate 8/10 markers | Confidence limited to drill 01 historical | Keep DEFERRED; trigger after schema/RLS-sensitive change | Owner | Accepted residual | Drill 02 evidence complete |
| A-SCHEMA-01 | Latest Public Catalog schema recoverability not verified | Public Catalog rollback confidence | MEDIUM | `LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED` | Catalog schema restore uncertainty | Keep visible; consider drill 02 | Owner/Portal | Accepted residual | Verified restore of latest catalog schema |
| A-RLS-REC-01 | Latest Clubs RLS remediation recoverability not verified on drill | Clubs tenant isolation restore | MEDIUM | Recovery register + post-apply after drill snapshot | Policy-state restore uncertainty | Keep visible; include policies in drill 02 | Security/Owner | Accepted residual | Drill proves remediated policy set restores |
| A-ECO-01 | Ecosystem real providers / Production webhooks absent | Ecosystem scope | MEDIUM | Gate 10 condition register | No live third-party integration | Keep NOT_APPROVED | Integrations | Excluded from constrained GO | Provider + webhook smoke certified |
| A-MOBILE-STORE-01 | iOS/Android store release not approved | Mobile store scopes | LOW | Gate 10 scope matrix | Web PWA ≠ store release | Keep NOT_APPROVED | Mobile | Separate certification | Store evidence package |
| A-IR-ROSTER-01 | Live incident contact roster not in-repo | Incident comms | LOW | `RC-IR-ROSTER-01` | Possible comms delay | Owner acknowledge offline OK or record roster | Owner | FOLLOW_UP | Roster recorded or accept |

## New anomalies from this 24h window

```text
NEW_CRITICAL=NONE
NEW_HIGH=NONE
NEW_MEDIUM_BEYOND_KNOWN_CONDITIONS=NONE
```

All MEDIUM/HIGH rows above are **known release conditions / accepted exceptions** re-confirmed, not newly introduced defects.

## Stop conditions (escalation)

| Severity | Stop condition |
|----------|----------------|
| CRITICAL | Tenant isolation breach; auth bypass; private data on public catalog → consider `PAUSE_PRODUCTION_WEB` / rollback |
| HIGH | Auth outage; Clubs/Courts public outage; backup failure → same-day Owner/Ops; consider `PAUSE_AFFECTED_SCOPE` |
| MEDIUM/LOW | Track under constrained continuity; do not silent-close ACCEPTED_EXCEPTION rows |

## Marker

`PROD_OPS_24H_01_ANOMALY_REGISTER_RECORDED`
