# 03 — Rollout And Deferred Track Register

**Snapshot timestamp:** `2026-07-24T17:11:17+07:00`
**Fresh `origin/main`:** `f599f7e81ad938ea7f16b3c8b4eaa685e763bbc4`
**Rule:** Chỉ ghi track có **evidence** trong repo hoặc active worktree. Không suy diễn GitHub/Vercel/Supabase console setting nếu không có evidence trong repository.

## A. Active / evidenced Staging tracks

| Track | Owner | Status | Gate | Evidence |
|-------|--------|--------|------|----------|
| COMMS-ACT-02 Staging Apply | Communication Foundation owner + **Owner GO** | DIRTY docs in ops worktree; behind main | Owner GO trước remote staging apply; không chạy từ PGO | Worktree `.../comms-act-02-staging-apply`; `?? docs/communication-foundation/activation/comms-act-02/` |
| TT V6 / Team Tournament staging fixtures & evidence | Team Tournament owner | DIRTY untracked SQL/evidence/scripts | Staging-only scripts; Owner GO trước apply | Worktree `pickleball-team-tournament`; multiple `docs/v5/qa-evidence/tt-v6-*` + staging SQL |
| Competition Engine parallel cores / E2E-02 | Competition Engine owner | Active development; many behind main | Module gates + CI verify; pending CE ≠ Platform Core defect | CE worktrees + E2E-02 dirty under `src/features/competition-engine/**` |
| ECO-01 / Experience Channels 00 foundations | Module owners | Ahead commits; shared CI manifest delta | Serialize `scripts/ci/unit-test-files.json` | vs-main shared path on both worktrees |

## B. Active / evidenced Production-adjacent tracks

| Track | Owner | Status | Gate | Evidence |
|-------|--------|--------|------|----------|
| Phase 42N Production rollout pack (plans/scripts/evidence) | Club / Phase 42N owner + **Owner GO** | Untracked production plans & gate scripts in athlete-hotfix WT | **Owner GO Production** bắt buộc; PGO không execute | `pickleball-scheduler-athlete-hotfix`: `PHASE_42N*_PRODUCTION_ROLLOUT_*.md`, `scripts/phase42n-production-*.mjs` |
| Club hotfix / SoT production smoke | Club owner + **Owner GO** | Untracked prod smoke + local `.vercel.*` dir | Owner GO; verify đúng Vercel project | `pickleball-scheduler-club-hotfix` untracked smoke scripts & evidence |
| Detached prod pins (`prod-deploy-a797b88`, `p1c7-prod`, temp tt-v6-prod) | Historical deploy inspectors | CLEAN detached, far behind | Read-only inspect only unless Owner GO | Detached worktrees in inventory |

## C. Deferred tracks (Owner-closed)

| Track | Owner | Status | Gate | Notes |
|-------|--------|--------|------|-------|
| **Notification Production Phase 2C** | Notification owner + **Owner GO** | **`DEFERRED_BY_OWNER`** | **Closed** — không mở từ PGO-01 | Repo evidence: Phase 2B remediation docs state Production SQL apply reserved for Phase 2C Owner approval; PGO-00 selected remediation explicitly forbids reopen. **PGO-01 must not propose reopening Notification Phase 2C.** |

## D. Recently landed on fresh main (context only)

| Track | Status | Evidence |
|-------|--------|----------|
| Customer Management Phase 6 | Merged | `origin/main` subject = PR #224 |
| IA-01 Canonical Analytics Contracts | Merged earlier same day | Historical PR #225; IA worktree **absent** from current `git worktree list` |

## E. Explicit non-actions for PGO-01

- Không đề xuất mở lại Notification Phase 2C.
- Không Production deploy / SQL apply / secret rotate từ PGO.
- Không coi Competition Engine backlog / behind counts là lỗi Platform Core.
- Module rollout pending ≠ platform outage.
