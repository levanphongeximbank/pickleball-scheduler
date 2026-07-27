# Gate 9 — Release Condition Register

Normalized register for Gate 10 treatment. Types: `BLOCKER` / `GAP` / `ACCEPTED_EXCEPTION` / `FOLLOW_UP`.

| condition ID | title | type | severity | evidence | owner | deadline / trigger | release impact | Gate 10 treatment | closure criteria |
|--------------|-------|------|----------|----------|-------|--------------------|----------------|-------------------|------------------|
| B-AUDIT-TRACEABILITY-01 | Gate 1–7 audit packages missing on main | GAP (PARTIALLY_RESOLVED) | HIGH | Gate 9 `02_*` + `03_*`; Gate 8 REL-TRACE-01 | Audit/Owner | Before claiming full program lineage PASS | Must not narrate fabricated Gate 1–7 binders | Disclose partial lineage; optional reconstruct or waive → ACCEPTED_EXCEPTION | Packages on main **or** Owner waiver recorded |
| EX-PITR-01 | PITR not enabled (Owner cost) | ACCEPTED_EXCEPTION | MEDIUM | Gate 8 recovery register | Owner | Cost revisit or permanent accept | Residual RPO risk | Keep visible; do not silent-close | PITR enabled **or** explicit permanent accept |
| EX-STORAGE-01 | Storage object recovery not in DB backups | ACCEPTED_EXCEPTION | MEDIUM | Gate 8 recovery register | Owner | Separate Storage backup plan | Media/object loss risk | Keep visible | Storage backup plan verified |
| EX-DRILL02-01 | Restore drill 02 deferred | ACCEPTED_EXCEPTION | MEDIUM | Gate 8 recovery register | Owner | After next schema/RLS-sensitive change | Latest restore confidence limited | Keep deferred status | Drill 02 completed + evidence |
| EX-SCHEMA-01 | Latest Public Catalog schema recoverability not verified | ACCEPTED_EXCEPTION | MEDIUM | `LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED` | Owner/Portal | Drill 02 or schema-specific restore check | Catalog schema rollback uncertainty | Keep visible | Verified restore of latest catalog schema |
| EX-RLS-REC-01 | Latest Clubs RLS remediation recoverability not verified | ACCEPTED_EXCEPTION | MEDIUM | Recovery register + Clubs RLS apply after drill snapshot | Security/Owner | Drill 02 including clubs policies | Policy-state restore uncertainty | Keep visible | Drill proves remediated policy set restores |
| RC-ENV-01 | Vercel Production env values unreadable to audit agent | GAP | MEDIUM | Gate 8/9 explicit non-claim | Owner/Platform | Provide redacted env inventory | Blind spot on live config | Condition for GO_WITH_CONDITIONS | Redacted inventory reviewed |
| RC-RBAC-01 | Effective Production `VITE_RBAC_ENABLED` unread | GAP | MEDIUM | Auth config default + unread env | Owner | Confirm Vercel value | RBAC effective posture uncertain | Require confirm or accept code-default risk | Value confirmed in evidence |
| RC-MONITOR-01 | Monitoring / observability effectiveness gap | GAP | MEDIUM | PGO-02 / Gate 8 B-MONITORING-01 | Ops/Owner | Before claiming operational GO | Incident detectability limited | Condition / FOLLOW_UP | Platform IR monitoring SSOT PASS |
| RC-IR-ROSTER-01 | Live incident contact roster not in-repo | GAP | LOW | Gate 8 B-IR-ROSTER-01 | Owner | Owner offline roster OK if acknowledged | Comms delay risk | FOLLOW_UP | Roster recorded or Owner accept offline |
| RC-ECO-PROVIDERS-01 | Ecosystem real providers absent | GAP | MEDIUM | Gate 8 ecosystem matrix / ECO docs | Integrations | When enabling live connectors | No live third-party integration GO | Do not claim Prod connector GO | Real provider wired + verified |
| RC-WEBHOOK-01 | Production webhook / network client absence where applicable | GAP | MEDIUM | Ecosystem/comms deferred surfaces | Integrations | Before webhook-dependent features | Outbound automation not live | Exclude from GO scope or wire | Client present + smoke |
| RC-MOBILE-STORE-01 | Mobile store release not completed | GAP | LOW | Mobile/PWA classification | Mobile | Store submission decision | Web PWA ≠ store release | Separate from web GO | Store release evidence |
| RC-BM-STRUCTURAL-01 | Business Modules Club/Finance/CRM structural-only | FOLLOW_UP | MEDIUM | `13_MODULE_FINAL_STATUS.md` | Module owners | Per-module Prod activation | Whole-platform Prod % not certified | Do not upgrade structural → Prod GO | Module-specific Prod certification |
| EX-RPO-01 | Approximate RPO up to daily backup interval | ACCEPTED_EXCEPTION | MEDIUM | Recovery register | Owner | Accept or improve backup cadence | Data-loss window | Keep visible | Shorter RPO verified or accept |
| EX-DRILL-01 | Restore drill used older snapshot | ACCEPTED_EXCEPTION | LOW | Recovery register | Owner | Drill 02 | Confidence limited to snapshot age | Keep visible | Fresh-snapshot drill |

## Hard blockers declared by Gate 9?

**None.** No new `BLOCKER` / CRITICAL security blocker. Prior `B-CLUBS-RLS-01` remains **RESOLVED**.

## Security remediation state (carry-forward)

| ID | Status |
|----|--------|
| B-CLUBS-RLS-01 | RESOLVED (PR #318/#319; committed post-apply evidence) |

## Marker

`PLATFORM_FINAL_AUDIT_01_GATE_9_RELEASE_CONDITION_REGISTER_RECORDED`
