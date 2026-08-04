# Phase 6 Blocker Reconciliation

**Canonical baseline:** `origin/main@15f21e15a7127748e093cdc0494f2ca00f3dce42`

**Rule:** no item is classified `CLOSED_WITH_EVIDENCE` without mainline evidence.

| Blocker / observation | Classification | Severity | Evidence and rationale | Required Owner action |
|---|---|---:|---|---|
| Production backup/PITR/recovery | `OPEN_BLOCKER` | CRITICAL | Phase 5A: `BLOCKED_NOT_PROVABLE`; no usable backup, restore target, or rehearsal proven | Create/verify backup; prove PITR or approved alternative; rehearse restore and record RTO/RPO |
| Production GO authority | `OPEN_BLOCKER` | CRITICAL | Phase 5A/5B/5C: `productionExecutionGo=false`; request explicitly says Production GO = NO | Issue no GO until all gates close; later provide explicit signed/recorded Owner authorization |
| TT5D/M9 conflict history | `OPEN_BLOCKER` | HIGH | Phase 5C keeps TT5D non-executable due pre-existing objects without controlled migration provenance | Merge/review canonical reconciliation or regenerate controlled evidence from main; approve final M9 disposition |
| BR01–BR10 local closure package | `UNKNOWN_REQUIRES_EVIDENCE` | HIGH | Six commits and package exist on `fix/phase5d-br01-br10-local-closure`, absent from `origin/main` | Owner decides whether to merge/recreate the package; mainline evidence must bind exact implementation SHA |
| Phase 5 ordered execution runbook | `OPEN_BLOCKER` | HIGH | Mainline Phase 5A says `executionRunbookAccepted=false`; Phase 5B/C retain it | Accept exact M0–M11 order, stop conditions, verify steps, and rollback boundaries |
| Branching tool observation | `ACCEPTED_OBSERVATION` | LOW | Merged Phase 5 certificate records missing project-ref permission validation; DB certification was otherwise target-bound | Fix tool binding before relying on Branching; no effect on this repository-only audit |
| npm vulnerabilities | `ACCEPTED_OBSERVATION` | HIGH | Reproduced: 5 moderate + 15 high; merged Phase 5 evidence already retained this observation | Security/Owner triage exploitability and document accept/remediate/defer decision; do not auto-fix package files |
| Build warnings | `ACCEPTED_OBSERVATION` | MEDIUM | Build PASS; large chunk and browser `node:crypto` externalization warnings reproduced | Confirm runtime path is safe; track bundle split separately if accepted |
| Supabase advisor findings | `OPEN_BLOCKER` | CRITICAL | Current proven-target Staging advisors: 516 security findings (8 ERROR, including security-definer views and public tables without RLS) plus 504 performance findings | Triage every ERROR and privileged-function exposure; bind remediation/defer decisions to exact objects and evidence |
| Clubs RLS / cross-tenant historical risk | `CLOSED_WITH_EVIDENCE` | HIGH | `docs/clubs-rls-remediation-01/CLUBS_RLS_PRODUCTION_APPLY_01_CERTIFIED.md` and its evidence package record remediation; no new live claim made | Preserve evidence; re-certify tenant isolation as a cutover Production gate |
| Production publication / Realtime readiness | `OPEN_BLOCKER` | HIGH | Staging Phase 5 publication is evidenced; Production publication was not accessed or certified | Verify exact tables/publication read-only after Owner authorizes a future Production readiness session |
| M8 text-tenant hotfix | `CLOSED_WITH_EVIDENCE` | HIGH | Mainline M8 manifest uses text tenant contract; focused tests for hotfix and SSOT pass | Preserve checksum/order in final execution package |
| Anonymous/public write exposure | `UNKNOWN_REQUIRES_EVIDENCE` | HIGH | Static RLS/RPC packages exist, but no current Production exposure inventory was authorized | Run approved read-only ACL/RLS inventory and negative-role QA before GO |
| RBAC and privileged paths | `UNKNOWN_REQUIRES_EVIDENCE` | HIGH | Code gates and tests pass; Production eight-role acceptance remains incomplete in GA QA | Complete Production role matrix, privileged RPC, and URL/action negative tests |
| Production SQL apply | `OPEN_BLOCKER` | HIGH | Mainline readiness documents retain missing/not-execution-approved migration families; no SQL was applied in this audit | Close backup/runbook gates, then obtain explicit Owner GO for a separate execution phase |
| Production environment / feature flags | `UNKNOWN_REQUIRES_EVIDENCE` | HIGH | GA environment checklist remains pending; this audit did not access Vercel/Netlify/Supabase env | Owner validates required env names/targets without exposing values and signs checklist |
| Monitoring/logging and canary | `OPEN_BLOCKER` | HIGH | No current accepted monitoring thresholds, alert ownership, canary/pilot, or abort criteria found | Define dashboards, alerts, on-call owner, pilot cohort, success/abort thresholds |
| Staging operator acceptance | `CLOSED_WITH_EVIDENCE` | MEDIUM | Phase 4 final evidence records 17/17 PASS and security reconciliation PASS | Retain; rerun only if execution package/runtime changes materially |
| Production operator acceptance | `OPEN_BLOCKER` | HIGH | GA Production QA role matrix and manual acceptance remain incomplete | Complete signed eight-role QA after approved deployment and before GO |
| Package/lock integrity | `CLOSED_WITH_EVIDENCE` | HIGH | Fresh main blobs match after `npm ci`; no package file edits | Preserve exact blobs through PR review |
| Current Staging live drift | `UNKNOWN_REQUIRES_EVIDENCE` | MEDIUM | `DATABASE_LIVE_RECHECK=READ_ONLY_PARTIAL`: migrations, table/RLS summaries, row counts, and advisors checked; exact policies/Realtime/protected counts not rechecked because SQL is forbidden | Complete remaining checks through approved non-SQL read-only capabilities before execution |

## Reconciliation result

- `CLOSED_WITH_EVIDENCE`: 4
- `OPEN_BLOCKER`: 9
- `ACCEPTED_OBSERVATION`: 3
- `DEFERRED_WITH_OWNER_APPROVAL`: 0 (no new Owner approval was inferred)
- `OUT_OF_SCOPE`: 0
- `UNKNOWN_REQUIRES_EVIDENCE`: 5

The CRITICAL backup/recovery and authorization blockers, plus multiple HIGH execution/security blockers, require `PHASE6_READINESS_BLOCKED`.
