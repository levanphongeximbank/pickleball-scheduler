# Gate 10 — Post-Release Control Plan

**Nature:** Documentation / control plan only. Gate 10 creates **no** live automations and mutates **no** systems.

## First 24 hours

| Control | Action | Owner |
|---------|--------|-------|
| Deploy parity | Confirm Production deploy SHA still matches approved main tip after Gate 10 merge (when merged) | Owner/Ops |
| Public smoke | Check `pickvn.app` `/`, `/clubs`, `/courts`, manifest, SW = 200 | Ops |
| Auth sanity | Spot-check login/session restore on Production (no secret logging) | Owner |
| Clubs isolation watch | Watch for cross-tenant access reports | Security/Owner |
| Catalog honesty | Confirm Tournaments/Rankings remain honest-empty if not populated | Portal |
| Incident intake | Owner reachable for CRITICAL escalation | Owner |
| No silent scope expand | Do not announce GA / store / ecosystem live | Owner |

## First 7 days

| Control | Action | Owner |
|---------|--------|-------|
| RC-ENV-01 | Deliver redacted Production env inventory | Owner/Platform |
| RC-RBAC-01 | Confirm `VITE_RBAC_ENABLED` effective value or accept code-default risk | Owner |
| Monitoring gap | Review available Vercel/Supabase dashboards; document what is/isn't alerted | Ops |
| Backup check | Confirm scheduled backups still active (no PITR enable unless Owner GO) | Owner |
| Pilot boundary | If pilots run, keep tenant list limited and logged | Owner |
| Condition register | No silent closure of ACCEPTED_EXCEPTION rows | Audit/Owner |
| Traceability | Decide reconstruct Gate 1–7 packages vs waiver | Owner |

## First 30 days

| Control | Action | Owner |
|---------|--------|-------|
| RC-MONITOR-01 | Progress toward monitoring/IR effectiveness evidence | Ops |
| Drill 02 trigger review | Schedule or reaffirm deferral of restore drill 02 | Owner |
| Storage plan | Outline Storage object backup approach or reaffirm accept | Owner |
| Module roadmap | Identify which Business/Competition/IA scopes seek certification next | Module owners |
| Ecosystem gate | Keep providers/webhooks offline until activation package exists | Integrations |
| Store gate | Keep iOS/Android NOT_APPROVED until store evidence | Mobile |
| Residual severity review | Re-rate residual MEDIUM items with new evidence | Audit/Owner |

## Incident escalation

| Severity | Trigger examples | Response |
|----------|------------------|----------|
| CRITICAL | Tenant isolation breach; auth bypass; private data on public catalog | Stop-ship candidate; Owner + Security; consider rollback |
| HIGH | Auth outage; Clubs/Courts public outage; backup failure | Owner/Ops same-day; status page/comms as Owner directs |
| MEDIUM | Partial channel degradation; pilot-only defects | Track; fix via normal PR process |
| LOW | Cosmetic / non-user-blocking | Backlog |

## User access anomalies

- Investigate unexpected admin/super-admin grants
- Investigate mass failed logins or session anomalies
- Do not disable RBAC in Production without Owner change control
- Record findings without printing secrets

## Tenant-isolation incidents

- Treat as CRITICAL until disproven
- Preserve Clubs RLS remediation evidence as baseline (`select_policy_count=1`, `writer_policy_count=0`)
- No Production SQL policy changes without explicit Owner GO and separate workstream
- Consider drill 02 acceleration if policy-state restore confidence is needed

## Backup failures

- Owner verifies Supabase backup status
- Do not claim PITR coverage
- Escalate HIGH if backups fail within retention window
- Do not connect recovery projects to applications without Owner GO

## Public Catalog failures

- Prefer honest-empty over incorrect/private data
- If privacy/DTO breach suspected → CRITICAL stop-ship path
- Use prior PC test suites for regression after fixes

## Auth / RBAC failures

- Confirm whether failure is code regression vs env misconfiguration (`RC-RBAC-01`)
- Rollback deploy if auth completely broken on Production
- Avoid Preview/Production RBAC bypass paths

## Deployment rollback

- Owner-initiated only
- Roll back via Vercel prior Production deployment / git revert PR — agent does not deploy
- After rollback, re-smoke public routes and record SHA

## Monitoring gaps

- Until `RC-MONITOR-01` closes, assume detectability is limited
- Rely on Owner manual checks (24h/7d cadence)
- Do not claim automated IR readiness

## Recovery drill 02 trigger

Trigger drill 02 when any of:

- Schema-sensitive Public Catalog change applied to Production
- Clubs RLS / tenant policy change applied
- Owner requests recoverability closure for EX-SCHEMA-01 / EX-RLS-REC-01
- Backup or incident demonstrates need for fresh-snapshot proof

Until then: `RESTORE_DRILL_02=DEFERRED` remains accepted.

## Mobile and ecosystem activation gates

| Gate | Prerequisite |
|------|--------------|
| iOS App Store | Store certification package; `RC-MOBILE-STORE-01` closed |
| Android Play Store | Store certification package; `RC-MOBILE-STORE-01` closed |
| Ecosystem live | Real providers + credentials/resolvers + webhook smoke; close RC-ECO / RC-WEBHOOK |
| Competition GA | Remote Staging + Prod activation beyond local MVP |
| Business Module GA | Per-module Production certification (not structural-only) |

## Marker

`PLATFORM_FINAL_AUDIT_01_GATE_10_POST_RELEASE_CONTROL_PLAN_RECORDED`
