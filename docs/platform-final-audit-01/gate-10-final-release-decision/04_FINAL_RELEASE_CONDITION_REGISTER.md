# Gate 10 — Final Release Condition and Exception Register

Normalized register for final release decision.  
Classifications: `BLOCKER` / `RELEASE_CONDITION` / `ACCEPTED_EXCEPTION` / `FOLLOW_UP`.  
Severities: `CRITICAL` / `HIGH` / `MEDIUM` / `LOW`.

**Hard blockers at Gate 10 decision time:** **NONE** (no CRITICAL open blocker making current constrained web continuity unsafe).

| ID | Title | Classification | Severity | Current state | Evidence | Owner | Release scope affected | Release impact | Mandatory before release or post-release | Closure criteria | Target trigger | Gate 10 treatment |
|----|-------|----------------|----------|---------------|----------|-------|------------------------|----------------|------------------------------------------|------------------|----------------|-------------------|
| B-AUDIT-TRACEABILITY-01 | Gate 1–7 audit packages missing on main | RELEASE_CONDITION (PARTIALLY_RESOLVED) | HIGH | PARTIALLY_RESOLVED | Gate 9 `02_*`/`03_*`; Gate 10 `02_*` | Audit/Owner | Audit narrative; program honesty | Must not claim full lineage PASS | Post-release (or pre-GA marketing claims) | Packages on main **or** Owner waiver → ACCEPTED_EXCEPTION | Before claiming full historical closure | Disclose partial lineage; preserve PARTIALLY_RESOLVED |
| EX-PITR-01 | PITR not enabled (Owner cost) | ACCEPTED_EXCEPTION | MEDIUM | OWNER_DECLINED_COST / NOT_ENABLED | Gate 8 recovery register | Owner | Recovery / RPO | Residual point-in-time restore gap | Post-release (unless Owner revisits) | PITR enabled **or** permanent accept recorded | Cost revisit | Keep visible; do not silent-close |
| EX-STORAGE-01 | Storage object recovery not in DB backups | ACCEPTED_EXCEPTION | MEDIUM | NOT_COVERED | Gate 8 recovery register | Owner | Media/object recovery | Object loss risk outside DB backup | Post-release | Storage backup plan verified | Separate Storage plan | Keep visible |
| EX-DRILL02-01 | Restore drill 02 deferred | ACCEPTED_EXCEPTION | MEDIUM | DEFERRED | Gate 8 recovery register | Owner | Latest restore confidence | Confidence limited to drill 01 historical | Post-release / after schema-sensitive change | Drill 02 completed + evidence | After next schema/RLS-sensitive change | Keep DEFERRED |
| EX-SCHEMA-01 | Latest Public Catalog schema recoverability not verified | ACCEPTED_EXCEPTION | MEDIUM | NOT_VERIFIED | `LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED` | Owner/Portal | Public Catalog | Catalog schema rollback uncertainty | Post-release | Verified restore of latest catalog schema | Drill 02 or schema restore check | Keep visible |
| EX-RLS-REC-01 | Latest Clubs RLS remediation recoverability not verified | ACCEPTED_EXCEPTION | MEDIUM | NOT_VERIFIED on drill | Recovery register + Clubs RLS after drill snapshot | Security/Owner | Clubs tenant isolation restore | Policy-state restore uncertainty | Post-release | Drill proves remediated policy set restores | Drill 02 including clubs policies | Keep visible |
| EX-RPO-01 | Approximate RPO up to daily backup interval | ACCEPTED_EXCEPTION | MEDIUM | ACCEPTED | Recovery register | Owner | Data-loss window | Up to ~daily RPO | Post-release | Shorter RPO verified or permanent accept | Backup cadence revisit | Keep visible |
| EX-DRILL-01 | Restore drill 01 used older snapshot | ACCEPTED_EXCEPTION | LOW | ACCEPTED | Recovery register | Owner | Recovery confidence | Historical mechanics only | Post-release | Fresh-snapshot drill | Drill 02 | Keep visible |
| RC-ENV-01 | Vercel Production env values unreadable to audit | RELEASE_CONDITION | MEDIUM | OPEN | Gate 8/9/10 non-claim | Owner/Platform | Production config trust | Blind spot on live config | Mandatory before broader GA claims | Redacted inventory reviewed | Provide redacted env inventory | Condition for GO_WITH_CONDITIONS |
| RC-RBAC-01 | Effective Production `VITE_RBAC_ENABLED` unread | RELEASE_CONDITION | MEDIUM | OPEN | Auth config default + unread env | Owner | Authenticated multi-tenant | Effective RBAC posture uncertain | Mandatory before broader auth GA claims | Value confirmed in evidence **or** Owner accepts code-default risk | Confirm Vercel value | Require confirm or explicit accept |
| RC-MONITOR-01 | Monitoring / observability effectiveness gap | RELEASE_CONDITION | MEDIUM | OPEN | PGO-02 / Gate 8 B-MONITORING-01 | Ops/Owner | Incident detectability | Limited operational GO | Mandatory before claiming Ops-ready GA | Platform IR monitoring SSOT PASS | Before Ops GO claims | Condition / FOLLOW_UP hybrid |
| RC-IR-ROSTER-01 | Live incident contact roster not in-repo | FOLLOW_UP | LOW | OPEN (Owner offline OK if acknowledged) | Gate 8 B-IR-ROSTER-01 | Owner | Incident comms | Comms delay risk | Post-release | Roster recorded or Owner accept offline | Owner acknowledgement | FOLLOW_UP |
| RC-ECO-PROVIDERS-01 | Ecosystem real providers absent | RELEASE_CONDITION | MEDIUM | OPEN | Gate 8 ecosystem matrix / ECO docs | Integrations | Ecosystem scope | No live third-party integration GO | Mandatory before ecosystem activation | Real provider wired + verified | When enabling live connectors | Exclude from GO scope |
| RC-WEBHOOK-01 | Production webhooks / network clients absent where applicable | RELEASE_CONDITION | MEDIUM | OPEN | Ecosystem/comms deferred surfaces | Integrations | Outbound automation | Not live | Mandatory before webhook-dependent features | Client present + smoke | Before webhook features | Exclude or wire |
| RC-MOBILE-STORE-01 | Mobile iOS/Android store release not completed | RELEASE_CONDITION | LOW | OPEN | Mobile/PWA classification | Mobile | Store release scopes | Web PWA ≠ store release | Mandatory before store GA | Store release evidence | Store submission decision | Separate from web GO |
| RC-BM-STRUCTURAL-01 | Business Modules Club/Finance/CRM structural-only; whole BM Prod % not certified | FOLLOW_UP / RELEASE_CONDITION | MEDIUM | OPEN | `13_MODULE_FINAL_STATUS.md` / Gate 9 | Module owners | Business Modules / GA | Do not upgrade structural → Prod GO | Mandatory before BM GA | Module-specific Prod certification | Per-module activation | Do not upgrade in Gate 10 |
| RC-COMP-MVP-01 | Competition Engine certified local MVP only | RELEASE_CONDITION | MEDIUM | OPEN | E2E-07 / Gate 8–9 | Competition | Competition Engine | Not full Prod GO | Mandatory before Competition GA | Remote Staging + Prod activation evidence | Separate rollout | NOT_APPROVED for GA |
| RC-IA-PROD-01 | Intelligence & Analytics not Production-certified | FOLLOW_UP | MEDIUM | OPEN | Gate 8/9 readiness | Analytics | Intelligence scope | No Prod GO | Post-release / before IA GA | Prod activation package | Separate certification | Exclude from GO scope |
| SEC-CLUBS-RLS-01 | Clubs RLS remediation | FOLLOW_UP (resolved blocker) | — (was HIGH/CRITICAL historically) | **RESOLVED** | PR #318/#319; post-apply select=1 writer=0; broad OR removed | Security | Clubs | Closed for release decision | N/A (resolved) | Keep RESOLVED; optional drill 02 reconfirm | Already merged | Preserve RESOLVED; no reopen without evidence |

## Hard blockers

```text
HARD_BLOCKERS=NONE
```

No CRITICAL open item makes constrained existing web Production continuity unsafe on current evidence. Material conditions remain — therefore final decision cannot be unqualified `GO`.

## Security remediation state (carry-forward)

| ID | Status |
|----|--------|
| B-CLUBS-RLS-01 | **RESOLVED** |
| Production clubs SELECT policy count | 1 (committed evidence) |
| Production clubs writer policy count | 0 (committed evidence) |
| Broad `OR status='active'` | Removed |
| Business data mutations during remediation verification | 0 |
| Gate 10 Production SQL re-query | **NOT performed** (boundary) |

## Recovery classification (preserve exactly)

```text
RECOVERY_READINESS_DECISION_01=CLOSED_WITH_ACCEPTED_EXCEPTIONS
RECOVERY_READINESS=CERTIFIED_WITH_GAPS
PITR=NOT_ENABLED
STORAGE_OBJECT_RECOVERY=NOT_COVERED
RESTORE_DRILL_02=DEFERRED
LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED
OWNER_RISK_ACCEPTANCE=YES
```

Additional preserved statements:

- Latest Clubs RLS remediation recoverability not verified
- Approximate RPO may be up to the daily backup interval
- Restore drill 01 verified historical recovery mechanics only

## Marker

`PLATFORM_FINAL_AUDIT_01_GATE_10_RELEASE_CONDITION_REGISTER_RECORDED`
