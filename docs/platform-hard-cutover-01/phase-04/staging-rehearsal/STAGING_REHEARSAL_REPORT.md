# PLATFORM-HARD-CUTOVER-01 — Staging Rehearsal Report

**Marker:** `PLATFORM_HARD_CUTOVER_01_STAGING_REHEARSAL_BLOCKED`  
**App tip:** `27e231a2` (PR #327 merge)  
**Date:** 2026-07-28

## 1. Final Staging verdict

**BLOCKED.** Hard stops fired before ordered wipe / DROP / SPA flag cutover. Incomplete M8 apply was rolled back via authored `90_ROLLBACK`. Protected identity counts unchanged. **Production mutations = 0.**

## 2. Exact Staging project identity

| Field | Value |
|-------|-------|
| MCP server | `project-0-pickleball-scheduler-supabase-staging` |
| project_ref | `qyewbxjsiiyufanzcjcq` |
| Production ref (blocked) | `expuvcohlcjzvrrauvud` |
| Tip before rehearsal | `20260728000727` `prod_sec_g3_b12_01_club_ai_data_anon_write_lockdown` |

## 3. Backup evidence

| Check | Result |
|-------|--------|
| Provider console backup via MCP | `NOT_VERIFIABLE_VIA_MCP` |
| Fresh pre-rehearsal backup (2026-07-28) | **MISSING** |
| Latest local logical zip | `...-20260725-153201-REPORTING-03.zip` (~3 days old) |
| Gate | **FAIL → STOP before wipe** |

Evidence: `evidence/01_BACKUP_LOGICAL_SNAPSHOT.json`

## 4. Protected-object precheck

**PASS** — auth 87 / profiles 87 / venues 2 / tenant_members 3 / roles 12 / permissions 144 / role_permissions 432 / plans 4 / plan_limits 4 / catalog RPCs 4 / SUPER_ADMIN profiles 2. Unchanged after M8 rollback.

Evidence: `evidence/02_PROTECTED_OBJECT_PRECHECK.json`

## 5. Migration apply results (M0–M11)

| Family | Result |
|--------|--------|
| M0 G3-B12 | ALREADY_PRESENT |
| M1–M7, M9–M11 | ALREADY_PRESENT on Staging |
| **M8 Competition SSOT** | **BLOCKED** (see §6) |

Evidence: `evidence/03_MIGRATION_APPLY_RESULTS.json`

## 6. Competition M8 apply result

1. `10_tables` — SUCCESS  
2. `20_indexes` — SUCCESS  
3. `30_rls` — **FAIL** `uuid = text` (`tenant_id uuid` vs `user_venue_id() RETURNS text`; `venues.id` is `text`)  
4. `40_rpc` / `50_grants` — NOT APPLIED  
5. Authored rollback `90_ROLLBACK` — **SUCCESS**; `competition_ssot_*` absent  

**Root cause:** Phase 4 M8 package schema incompatible with Staging identity helper types.

## 7. Rating apply result

Rating V5 foundation already present (`phase_v5a_rating_*`). No additional Rating cutover SQL executed. Live Rating V5 activation / idempotency **NOT_RUN** (flags not enabled).

## 8. Ordered wipe result

**NOT_EXECUTED** (backup gate FAIL).

## 9. club_ai_data drop result

**NOT_EXECUTED** — `public.club_ai_data` still exists; G3-B12 deny-all remains.

## 10. Staging deployment / flag result

**NOT_EXECUTED** — `VERCEL_CLI=ABSENT`. Flags remain unset on Staging.

## 11. Reseed result

**NOT_EXECUTED.**

## 12. Owner login / RBAC / tenant result

Protected objects intact (counts). Live Owner login after cutover **NOT_TESTED** (no cutover).

## 13. Competition E2E result

Live Staging cutover E2E **NOT_RUN**. (Pre-merge unit/E2E-07 packages remain PASS on main code; not re-certified against Staging DB cutover.)

## 14. Finalized-result single-writer result

**NOT_CERTIFIED** — finalize RPC not present on Staging after rollback.

## 15. Rating idempotency result

**NOT_RUN.**

## 16. Public Catalog result

Structural: 4 `public_catalog_list_%` RPCs present. No wipe → catalog biz data not reseeded/cleared.

## 17. Six acceptance criteria

All six: **NOT_CERTIFIED** (runtime cutover incomplete).

## 18. Legacy authority scan result

Code gates present on `origin/main` (`platform-hard-cutover` + competition SSOT adapters). Live Staging SPA **not** cut over → hybrid/legacy runtime still possible in deployed env.

## 19. Rollback readiness

| Item | Status |
|------|--------|
| M8 rollback package | Used successfully to clean partial apply |
| Staging provider restore | Needs Owner console + **fresh** backup |
| Wipe rollback | N/A |

## 20. Staging mutations

Schema migrations applied then rolled back for M8 only (`10_tables`, `20_indexes`, failed `30_rls`, then `90_rollback`). **No wipe. No DROP club_ai_data. No flag/deploy.**

## 21. Production mutations

**0.** Production MCP not used for apply/mutate (accidental Production SQL blocked by auto-review).

## 22. Blocker register

| ID | Sev | Title |
|----|-----|-------|
| B-STG-01 | HIGH | Fresh Staging backup not verified — hard stop |
| B-STG-02 | HIGH | M8 `tenant_id uuid` incompatible with `user_venue_id(): text` / `venues.id text` |
| B-STG-03 | HIGH | Vercel CLI absent — cannot Staging SPA redeploy / enable flags |
| B-STG-04 | MED | Ordered wipe / DROP / reseed / acceptance deferred |

## 23. Evidence paths

- `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/01_BACKUP_LOGICAL_SNAPSHOT.json`
- `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/02_PROTECTED_OBJECT_PRECHECK.json`
- `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/03_MIGRATION_APPLY_RESULTS.json`
- `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/04_DESTRUCTIVE_AND_RUNTIME.json`
- `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/99_STAGING_REHEARSAL_BLOCKED.json`
- `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/STAGING_REHEARSAL_REPORT.md`

## 24. Recommendation for Phase 5

**Do not start Phase 5.** Fix blockers on a new Owner-approved package/PR, then re-run full Staging rehearsal to PASS marker before any Production GO.

Required before re-rehearsal:

1. Owner creates + confirms **fresh** Staging provider backup (2026-07-28+).  
2. Hotfix M8: `tenant_id` / RPC `p_tenant_id` must be **text** (match `venues.id` + `user_venue_id()`), then re-apply M8 10→50 + `99_VERIFY`.  
3. Owner enables Staging Vercel deploy + three cutover flags.  
4. Re-run wipe → DROP → reseed → full acceptance + six criteria.

## 25. Owner next step

1. Confirm Staging console backup for project `qyewbxjsiiyufanzcjcq`.  
2. Approve M8 type hotfix PR (text tenant_id).  
3. Ensure Vercel Staging access for deploy/flags.  
4. Re-issue `OWNER GO` for Staging rehearsal only after 1–3.
