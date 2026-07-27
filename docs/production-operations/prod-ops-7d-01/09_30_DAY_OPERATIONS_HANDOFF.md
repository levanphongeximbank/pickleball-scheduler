# PROD-OPS-7D-01 — 30-Day Operations Handoff

**From:** Seven-day operational control package (PROD-OPS-7D-01)  
**To:** First 30-day constrained Production operations window  
**Operating mode to continue:** `CONTINUE_CONSTRAINED_PRODUCTION`  
**Inherited mode:** `CONSTRAINED_PRODUCTION_WEB_CONTINUITY`  
**7D verdict:** `PROD_OPS_7D_PASS_WITH_OBSERVATIONS`

## What the 7D package confirmed

- Fresh `origin/main` = PR #323 merge `f52cfbf8…`; Production deploy tip `5626047618` matches
- Public routes `/`, `/clubs`, `/courts`, `/login`, `/tournaments`, `/rankings`, manifest, SW = 200 on current tip
- Clubs=1 / Courts=4; ACCC + Sân 3–6; privacy fields ABSENT on public RPC
- Effective `VITE_RBAC_ENABLED` classified **VERIFIED_ENABLED** (value not printed)
- Monitoring classified **MONITORING_PARTIALLY_EFFECTIVE** (manual smoke detectability PASS; automated IR NOT_VERIFIED)
- Backup continuity Active-per-prior-certification; PITR still NOT_ENABLED; drill 02 DEFERRED; Storage GAP preserved
- No new CRITICAL continuity blockers

## 30-day control cadence

| Cadence | Control | Owner |
|---------|---------|-------|
| Daily (light) | Owner reachable for CRITICAL; watch isolation/auth reports | Owner/Ops |
| 2–3× / week | Public smoke: `/`, `/clubs`, `/courts`, `/login`, manifest, SW | Ops |
| Weekly | Backup status glance (Active / no failed job); do not enable PITR without GO | Owner |
| Weekly | Confirm Tournaments/Rankings honest-empty **or** certify new publish evidence | Portal |
| Bi-weekly | Redacted env inventory progress (`RC-ENV-01`) | Owner/Platform |
| Bi-weekly | Monitoring dashboard note (`RC-MONITOR-01`) — what is/isn't alerted | Ops |
| Day 30 | Residual severity review; decide continue constrained vs expand program | Owner |

## Remaining daily checkpoints (complete the seven-day series)

Record dated rows for days not captured at 7D authorship (A-CAL-01). Minimum fields: timestamp, HTTP status per route, deploy SHA if known, anomaly ID.

## Open conditions that must stay visible

```text
Vercel Production environment values=UNREADABLE (full inventory)
MONITORING automated IR=NOT_VERIFIED
PITR=NOT_ENABLED
STORAGE_OBJECT_RECOVERY=NOT_COVERED
RESTORE_DRILL_02=DEFERRED
LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED
latest Clubs RLS recoverability=NOT_VERIFIED
Tournaments=LIVE_EMPTY
Rankings=LIVE_EMPTY
whole-platform GA=NOT_APPROVED
iOS/Android store release=NOT_APPROVED
Ecosystem live activation=NOT_APPROVED
```

## Explicit non-goals (30 days)

- Do not announce whole-platform GA
- Do not submit iOS/Android store releases
- Do not activate ecosystem providers/webhooks without separate certification
- Do not enable PITR without Owner GO
- Do not run restore drill 02 unless triggered by schema/RLS-sensitive change + Owner GO
- Do not mutate Production schema/RLS without separate Owner-authorized workstream
- Do not expand Competition / Business Modules / Intelligence to Production GA claims

## Escalation (unchanged)

- CRITICAL → stop-ship candidate; Owner + Security; consider rollback / `PAUSE_PRODUCTION_WEB`
- HIGH → same-day Owner/Ops; consider `PAUSE_AFFECTED_SCOPE`
- MEDIUM/LOW → track via PR process; keep constrained mode

## Marker

`PROD_OPS_7D_01_30_DAY_OPERATIONS_HANDOFF_RECORDED`
