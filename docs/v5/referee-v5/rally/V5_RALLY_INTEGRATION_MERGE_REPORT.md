# Referee V5 Rally Scoring — Integration Merge Report

**Merge gate:** OWNER APPROVAL — REFEREE V5 RALLY INTEGRATION MERGE GATE
**Result:** PASS
**Type:** Development branch integration (NOT a Production rollout)
**Date:** 2026-07-15

---

## 1. Source and target

| Item | Value |
|------|-------|
| Source branch | `feature/referee-v5-rally-scoring` |
| Source local HEAD | `0c090a94b53b79f1092aea8158bfbdb3026617fd` |
| Source remote HEAD | `0c090a94b53b79f1092aea8158bfbdb3026617fd` |
| Source local == remote | YES (in sync) |
| Target branch | `feature/competition-core-standardization` |
| Target remote HEAD (pre-merge) | `0dd5238e1a229036b9538142c0bb0893a02fc59f` |
| Merge base | `00317e95058b5e195c3b89623cfe98925fffecad` |
| Divergence | source: 11 commits ahead of base; target: 31 commits ahead of base (true 3-way merge) |
| Source working tree | CLEAN |
| Main worktree | CLEAN (untouched) |

## 2. Merge branch and worktree

| Item | Value |
|------|-------|
| Merge worktree | `C:\Users\Le Phong\pickleball-scheduler-rally-merge` |
| Merge branch | `merge/referee-v5-rally-integration` |
| Merge strategy | `git merge --no-ff` (no squash, no rebase, no force) |
| Merge commit | `24392f56831d65afbd7da1022d6a430a05033248` |
| Merge commit parents | `0dd5238` (target, parent 1) + `0c090a9` (source, parent 2) |
| Report commit | see closeout / git log on merge branch |
| Files changed vs pre-merge target | 99 |

## 3. Conflicts and resolution

| File | Class | Resolution |
|------|-------|------------|
| `package.json` | package manifest — `test:unit` script line | **Additive union**. Target added `tests/competition-core-cc10-readiness.test.js`; source added 5 Rally referee-v5 tests (`referee-v5-scoring-strategy`, `referee-v5-usap-rally-doubles`, `referee-v5-rally-replay-integrity`, `referee-v5-rally-persistence`, `referee-v5-rally-edge-parity`). Resolved by keeping **both** sets. Verified: no conflict markers, valid JSON, both cc10 and Rally tests present. |

All other 98 files auto-merged cleanly with no conflicts. No bulk `ours`/`theirs` was used; the single conflict was a clear additive combination of two disjoint test-list additions. No runtime/scoring/SQL/permissions/Edge conflict occurred.

## 4. Post-merge regression

| Group | Result |
|-------|--------|
| Full unit suite (`test:unit`) | **2382 / 2382 PASS**, 0 fail |
| Referee V5 domain | **238 / 238 PASS** (baseline ≥238 met) |
| Rally group (rally-scoring + V5 rally + R2-2G TT) | **128 / 128 PASS** |
| Referee V5 UI (`referee-v5-rally-presentation` etc.) | Rally UI test PASS; overall UI 89 / 90 (see note) |
| Legacy referee | **29 / 29 PASS** (baseline ≥19 met) |
| Team Tournament full suite (incl. TT1b + R2-2G) | **147 / 147 PASS** |
| Standings group | **319 / 319 PASS** |
| Perf suite | **3 / 3 PASS** |
| Build (`npm run build`) | **PASS** (Vite + PWA precache generated) |
| Scoped lint (`lint:referee-v5`) | **PASS** |
| Changed-files lint (eslint, 43 files) | **PASS** (0 errors) |
| Secret scan (merged diff) | **CLEAN** (see note) |
| Route/import validation | **PASS** (build resolves all lazy imports; `v5-menu-audit` PASS) |
| Edge shared bundle freshness | **FRESH** (regenerated bundle byte-identical to committed; only CRLF artifact) |

### UI note — 1 failed test + 3 failed suites are PRE-EXISTING (not merge regressions)

The merge worktree UI run showed 4 failing UI files:
`app-shell.ui.test.jsx` (1 failed test: missing "Tổng quan" heading), and 3 suites failing to load with `TypeError: getClubDataKey is not a function` (`players.smoke`, `select-players.ui`, `settings.ui`).

These were reproduced **identically** on the pre-merge target baseline `0dd5238` (throwaway worktree, fresh `npm ci`): same 4 files fail, same errors. Therefore they are pre-existing on `feature/competition-core-standardization` and are **not** introduced by this merge. The merge additionally contributes the passing `tests/ui/referee-v5-rally-presentation.test.jsx`. **No new UI regression.**

### Secret scan note

4 pattern hits, all confirmed false positives:
- `eyJ…invalidsig` — well-known dummy JWT (jwt.io sample payload, invalid signature) used in staging verify scripts to test token rejection.
- `"…SUPABASE_SERVICE_ROLE_KEY": "PRESENT" / "CONFIGURED"` — status placeholders in evidence JSON, not real keys.
- Error-message reference to the env var name `STAGING_SUPABASE_SERVICE_ROLE_KEY`.

No real credentials or signed tokens in the merged diff.

## 5. Feature flag and Production safety

| Check | Result |
|-------|--------|
| `VITE_TT5_REFEREE_V5_RALLY_ENABLED` default | **OFF** (`.env.example` = `false`; unset resolves to `false`) |
| Rally UI (`TeamDisciplinesPanel`) | Gated behind `rallyFlagOn` — hidden when flag OFF |
| Rally provision (`assertProvisionScoringAllowed`) | Hard-blocks Rally when flag OFF |
| Dev preview route `/dev/referee-v5` | Behind `SuperAdminRouteGuard` — not exposed to Production users |
| Silent enablement | NONE detected |
| Side-Out path | Unchanged, remains the default/safe path |
| Production Edge | NOT deployed (merge only) |
| Production SQL | NOT applied (R2-2G SQL is docs-only; staging apply script guards against Production project ref) |
| Production deployment | NOT performed |

## 6. Integration audit (14 areas)

| # | Area | Status |
|---|------|--------|
| 1 | Authentication & session | PASS (auth suites green) |
| 2 | RBAC / referee assignment | PASS (rbac + team referee suites green) |
| 3 | Referee Side-Out | PASS (legacy + side-out strategies green) |
| 4 | Referee Rally | PASS (Rally group 128/128) |
| 5 | Team Tournament provision | PASS (R2-2G provision mapping green) |
| 6 | Team Tournament result consumer | PASS (consumer/idempotency/correction green) |
| 7 | Standings | PASS (319/319) |
| 8 | Realtime | PASS (e1-realtime green) |
| 9 | Router & feature flags | PASS (SuperAdmin-guarded dev route, flag OFF) |
| 10 | Supabase migrations inventory | PASS (docs-based SQL, not auto-applied, staging-guarded) |
| 11 | Edge bundle | PASS (fresh/in-sync) |
| 12 | Build & package scripts | PASS (build green; no r22g production apply script) |
| 13 | Legacy compatibility | PASS (legacy referee + Side-Out unchanged) |
| 14 | Rollback references | PASS (`R2-2G_ROLLBACK.sql` present) |

## 7. Remote status

| Item | Value |
|------|-------|
| Merge branch remote | `origin/merge/referee-v5-rally-integration` (pushed) |
| Target branch remote | `origin/feature/competition-core-standardization` fast-forwarded to merge commit |

## 8. Rollback reference

| Item | Value |
|------|-------|
| Pre-merge target SHA | `0dd5238e1a229036b9538142c0bb0893a02fc59f` |
| Merge commit SHA | `24392f56831d65afbd7da1022d6a430a05033248` |
| Revert command | `git revert -m 1 24392f56831d65afbd7da1022d6a430a05033248` |
| Feature flags to keep OFF | `VITE_TT5_REFEREE_V5_RALLY_ENABLED` |
| Edge Production rollback | Not required (never deployed) |
| Production SQL rollback | Not required (never applied); `R2-2G_ROLLBACK.sql` available if staging needs revert |

## 9. Working tree status

Merge worktree clean after merge + reports. Main worktree and other worktrees untouched.

---

**Production:** UNTOUCHED
**SQL:** NOT APPLIED TO PRODUCTION
**Deployment:** NOT PERFORMED TO PRODUCTION
