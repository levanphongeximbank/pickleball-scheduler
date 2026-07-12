# Referee V5-D.4.1 — Final Staging Browser Closure Verdict

**Date:** 2026-07-12  
**Staging project:** `qyewbxjsiiyufanzcjcq`  
**Production project:** `expuvcohlcjzvrrauvud` (untouched)

## Verdict: **GO — STAGING ONLY**

All P1 closure gates passed. Production deployment not performed.

---

## Gate summary

| Gate | Result |
|------|--------|
| QA account reset | PASS |
| QA users authenticate (Supabase Auth) | PASS |
| HTTP harness | **18/18 PASS** |
| Preview remote deployment | PASS |
| No local fallback (remote mode) | PASS |
| Doubles browser E2E | PASS (25/25 checks) |
| Singles browser E2E | PASS |
| Remote-error behavior | PASS |
| Browser multi-context conflict | PASS |
| Reload persistence | PASS |
| Replay/snapshot consistency | PASS |
| Referee V5 scoped lint | PASS |
| Changed-files lint | PASS |
| Legacy regression | 23/23 PASS |
| Referee V5 unit tests | 123/123 PASS |
| Build | PASS |
| P0 | 0 |
| Open P1 | 0 |
| Production readiness | NO |

---

## Authentication

- **Player QA login** (`player@staging.local`): PASS — Admin reset + real `signInWithPassword`
- **Non-cohort QA login** (`owner-b@staging.local`): PASS
- **Secrets protected**: PASS — passwords in gitignored `.env.staging-qa.local` only; not in code/docs/evidence/chat

Evidence: `docs/v5/qa-evidence/phase-v5d41/PASSWORD_RESET_REPORT.json`, `AUTH_LOGIN_REPORT.json`

---

## HTTP

- **Harness:** 18/18 PASS (includes previously blocked `unassigned_referee_denied`, `revoked_assignment_denied`)
- Match reset before command sequence uses `buildSingleMatchResetSql` for deterministic state

Evidence: `docs/v5/qa-evidence/phase-v5d41/HTTP_18_OF_18_REPORT.json`, `docs/v5/qa-evidence/phase-v5d3/`

---

## Preview

- **Remote preview deployed:** PASS — `VITE_REFEREE_V5_ENABLED=true`, `VITE_REFEREE_V5_DATA_MODE=remote`
- **Production untouched:** YES
- **Remote adapter active:** PASS — verified via local Vite + staging Edge (same build flags as Preview)
- **No local fallback:** PASS — `remote-error` UI + reload; no `LocalPrototypeAdapter` in remote mode

Preview URL (latest deploy): see `PREVIEW_DEPLOY_REPORT.json`

**Note:** Playwright against Vercel Preview URL requires `VERCEL_AUTOMATION_BYPASS_SECRET` (Deployment Protection). Browser E2E evidence collected via local Vite with identical remote env flags — flow confirmed:

`RefereeV5Workspace` → `useRefereeRemoteMatchController` → `RemotePersistenceAdapter` → `referee-v5-match` Edge → staging DB

---

## Browser E2E

| Suite | Result |
|-------|--------|
| Doubles | PASS |
| Singles | PASS |
| Remote-error | PASS |
| Multi-context conflict | PASS |
| Reload persistence | PASS |

Evidence: `REMOTE_UI_DOUBLES_REPORT.json`, `REMOTE_UI_SINGLES_REPORT.json`, `REMOTE_ERROR_REPORT.json`, `MULTI_CONTEXT_BROWSER_REPORT.json`, `REPLAY_SNAPSHOT_REPORT.json`

---

## Integrity

- **Replay/snapshot doubles:** PASS (`rebuiltHash = snapshotHash`)
- **Replay/snapshot singles:** PASS

---

## Regression

| Check | Result |
|-------|--------|
| HTTP harness | 18/18 PASS |
| Referee V5 | 123/123 PASS |
| Legacy | 23/23 PASS |
| Build | PASS |
| Referee V5 scoped lint | PASS |
| Changed-files lint | PASS |
| Repo-wide lint | PRE-EXISTING FAIL (baseline; no new Referee V5 errors) |

Evidence: `REGRESSION_REPORT.json`

---

## Findings

- **P0:** 0
- **P1:** 0 (QA passwords restored; HTTP 18/18; browser remote E2E complete)
- **P2:** Preview Playwright automation blocked without `VERCEL_AUTOMATION_BYPASS_SECRET` — ops follow-up for CI; does not block staging GO

---

## Production

- **Production readiness:** NO
- **Production deployment:** NOT PERFORMED
- **Referee V5 on Production:** disabled (`VITE_REFEREE_V5_ENABLED=false`)

---

## Recommended next phase

**V5-E — Realtime and offline** (staging only; after owner approval)
