# Phase 1B — Production Rollout Final Report

## Closure status

- Phase 1B Production rollout: **COMPLETE**
- Production smoke: **29/29 PASS**
- Code SHA: `959c8067ea756aa32e50b549a97cd4e762786ff7`
- Production SQL: **APPLIED_AND_VERIFIED**
- Phase 1C: **NOT STARTED**

**Final verdict:** **PASS**  
**Completed:** 2026-07-18  
**Production ref:** `expuvcohlcjzvrrauvud`  
**Approved / deployed code SHA:** `959c8067ea756aa32e50b549a97cd4e762786ff7`

## 1. SQL apply result

**APPLIED_AND_VERIFIED**

| # | File | Result |
|---|------|--------|
| 1 | `PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql` | PASS |
| 2 | `PHASE_45A3C_CLUB_UPDATE_RPC.sql` | PASS |
| 3 | `PHASE_45A4C1_MEMBER_RPC.sql` | PASS |
| 4 | `PHASE_45A4D1_MEMBER_RESTORE_RPC.sql` | PASS |
| 5 | `PHASE_1B_V2_COMMAND_COMPLETION.sql` | PASS |
| 6 | `PHASE_1B_CLUB_UPDATE_AUTHZ_SECURITY_GATE.sql` | PASS |
| 7 | Catalog verification | PASS |

Verified: narrow helpers present; `club_update` / VP RPCs use narrow auth; canonical has VP fields; RLS still enabled.

Evidence: `docs/v5/qa-evidence/phase1b-production/APPLY_REPORT.json`

## 2. Deployment result

**CONFIRMED** — Production serves main SHA `959c806` (Vercel `dpl_42HhuCKN3JHNjwSBt62E6ENBsHUF`, GitHub deployment `5502530815`). No other commit deployed.

Evidence: `docs/v5/qa-evidence/phase1b-production/DEPLOY_REPORT.json`

## 3. Smoke totals

**29 pass / 0 fail** — status **PASS**

Club under test: `club-219e4a7cbd73437eb6271f02a53314c3` (CLB ACCC)

## 4. Authorization matrix (`club_update`)

| Actor | Expected | Actual |
|-------|----------|--------|
| Owner | ALLOW | PASS |
| President | ALLOW | PASS |
| Tenant admin | ALLOW | PASS |
| Ordinary tenant | DENY | PASS |
| Player | DENY | PASS |
| Unrelated | DENY | PASS |
| Restore name | ALLOW | PASS |
| Stale version | VERSION_CONFLICT | PASS |

## 5. Audit verification

All present for club under test (recent window):

- `club.update`
- `club.assign_vice_president`
- `club.clear_vice_president`
- `club.member.add`
- `club.member.remove`
- `club.member.restore`

(Member audits use `club_id` + `resource_type=club_member`.)

## 6. Production version

- **Code:** `959c8067ea756aa32e50b549a97cd4e762786ff7`
- **SQL:** Phase 1B bundle applied on `expuvcohlcjzvrrauvud` (**APPLIED_AND_VERIFIED**)
- **App URL:** https://pickleball-scheduler-eight.vercel.app / https://pickvn.app

## 7. Evidence paths

- `docs/v5/qa-evidence/phase1b-production/APPLY_REPORT.json`
- `docs/v5/qa-evidence/phase1b-production/DEPLOY_REPORT.json`
- `docs/v5/qa-evidence/phase1b-production/SMOKE_REPORT.json`
- `docs/v5/qa-evidence/phase1b-production/SMOKE_REPORT.md`
- `docs/v5/qa-evidence/phase1b-production/ROLLOUT_FINAL_REPORT.md`
- `docs/v5/qa-evidence/phase1b-production/PRODUCTION_PREFLIGHT_REPORT.md`
- Harnesses: `scripts/apply-phase1b-production-sql.mjs`, `scripts/verify-phase1b-production-smoke.mjs`, `scripts/preflight-phase1b-production-readonly.mjs`

## 8. Rollback readiness

- DB: `CREATE OR REPLACE` prior function bodies if needed; **keep** additive audit constraint; **never** truncate/delete `audit_logs` / club tables
- Code: previous Vercel Production deployment before `dpl_42HhuCKN3JHNjwSBt62E6ENBsHUF` (pre-959c806) available for alias rollback
- Authz gate SQL is idempotent re-apply safe

## 9. Production health

- RLS remains enabled on clubs / members / governance / audit
- Club name restored after smoke
- Ephemeral QA Auth users may remain (membership soft-removed; DENY actors seeded only as needed)
- No truncate / no audit history delete
- **No further Production changes in this evidence commit**
- Phase 1C: **NOT STARTED**

## 10. Final verdict

**PASS — Phase 1B Production rollout: COMPLETE.**

Do not start Phase 1C until Owner schedules it after this evidence commit is on `main` and reviewed.
