# Phase 42J.1 — Staging Alignment & Route Stabilization

**Date:** 2026-07-10  
**Version:** 5.3.29  
**Production:** NOT deployed  
**Phase 42K:** NOT started  

## Verdict

**GO WITH CAVEATS (staging seed gaps)** — route stabilization, requests review, and core club flows pass on Preview. Blockers for full GO: `cashier@` / `admin@` staging auth passwords not in `.env.staging-qa.local` (cases 1 & 4 use RPC-mock / SQL seed evidence).

**Checkpoint:** Await **GO DEPLOY 42J.1** (Production promotion separate; not executed in this phase).

---

## Preview

| Item | Value |
|------|-------|
| URL | https://pickleball-scheduler-qmmmyhd7e-pickleball-scheduler.vercel.app |
| Deployment ID | `dpl_2pdoL4pP77xgzbesG9QgTSfVmXx6` |
| `VITE_CLUB_STORAGE_V2` | `true` (Vercel Preview env, permanent) |
| Commit | **Uncommitted** local `5.3.29` — hash pending user commit |

---

## Root causes

| Symptom | Root cause | Fix |
|---------|------------|-----|
| `/discover-clubs` ↔ `/my-club` flash | `menuAccess.js` used `profile.clubId` competing with V2 `club_get_my_active_membership` | Canonical `clubLandingResolver` + V2 PLAYER home `/my-club` |
| Blank white `/my-club` | Missing MUI `Button` import in `MyClubPage.jsx` | Import added |
| Infinite "Đang tải thông tin CLB" | `getMyClubSummary()` read local registry; V2 clubs not in blob | `buildMyClubSummaryFromClub()` RPC fallback + error/retry |
| `/my-club/requests` → `/my-club` or `/403` early | Guard required registry `clubRecord`; `revision` undefined crashed page | `ClubMembershipRequestsGuard` + V2 RPC probe; fix `MyClubRequestsPage` revision scope |
| Requests table empty | `listPendingMembershipRequests` returned `[]` when registry miss | V2 `club_list_pending_requests` path |
| `revision is not defined` (console) | `MyClubRequestsPage` outer component referenced `revision` not in scope | Lift `useState` to page root |
| `club_get_my_active_membership` ×4 | Guard + page each called hook; login landing + `/my-club` | `MyClubMembershipContext` + 3s in-flight/cache dedupe |
| Join/review audit fail (staging) | Missing 42I.1 `audit_logs_action_check` values | Applied hotfix SQL on staging |
| Case 1/4 QA login | `cashier@` / `admin@` passwords not in QA env | Documented; case 1 uses RPC-mock fallback |

---

## Migration parity (Staging ↔ Production)

| Object | Staging | Production | Parity |
|--------|---------|------------|--------|
| `audit_logs_action_check` | includes `club.membership_request.review`, `club.membership_request.correction` | same | ✅ |
| `phase42_can_review_membership` | present | present (42I.1) | ✅ |
| `phase42_write_audit` | present | present | ✅ |
| `club_list_pending_requests` | present | present | ✅ |
| `club_review_membership_request` | hotfix applied (`phase_42j1_review_rpc_hotfix`) | 42I.1 | ✅ |

---

## QA seed accounts (Staging DB)

| Account | Role | Active membership | Notes |
|---------|------|-------------------|-------|
| `player@staging.local` | PLAYER | ✅ `club-smoke-42i1` | president + club_owner governance |
| `cashier@staging.local` | CASHIER | ❌ 0 | Case 1 target (auth password blocked) |
| `admin@staging.local` | SUPER_ADMIN | ❌ 0 (seed removed) | Case 4 target (auth password blocked) |
| `club@staging.local` | — | pending request | Review QA row |
| Pending rows | — | 2 on `club-smoke-42i1` | Seeded via `PHASE_42J1_STAGING_QA_SEED.sql` |

---

## Browser QA (automated)

Evidence: `docs/v5/qa-evidence/phase42j1-staging/`  
Report: `PHASE_42J_STAGING_QA_REPORT.json`

| Case | Result | Evidence |
|------|--------|----------|
| 1 No membership → discover | PARTIAL | cashier login fail; player+RPC-mock → `/discover-clubs` |
| 2 Active member `/my-club` | PASS | Home stable, no self-join CTA |
| 3 Requests approve/reject | PASS | 2 pending rows; reject OK |
| 4 SA no membership | PARTIAL | admin login timeout; DB seed 0 clubs verified |
| 5 Legacy redirects | PASS | `/clubs/discover`, `?view=discover` → `/discover-clubs` |
| 6 RPC error + retry | PASS | Error UI on `/my-club`, retry renders home |
| 7 Nav links | PASS | `/discover-clubs` in menu; no legacy query links |
| 8 Console/network | PASS | No pageerror; no RPC spam; no 404 routes |

**Redirect trace (case 1 mock):** `/login` → `/my-club` → `/discover-clubs` (single hop, no ping-pong).

---

## Unit tests

```
node --test tests/club-route-42j.test.js tests/club-route-42j1.test.js
20/20 PASS
```

---

## File diff (42J.1)

**New**
- `src/features/club/routing/clubLandingResolver.js`
- `src/features/club/hooks/MyClubMembershipContext.jsx`
- `src/features/club/hooks/useResolvedClubRecord.js`
- `src/pages/player/guards/ClubMembershipRequestsGuard.jsx`
- `tests/club-route-42j1.test.js`
- `docs/v5/PHASE_42J1_STAGING_QA_SEED.sql`
- `docs/v5/PHASE_42J1_ROLLBACK.md`
- `docs/v5/PHASE_42J1_STAGING_REPORT.md`

**Modified**
- `src/pages/player/MyClubPage.jsx` — summary fallback, error/retry, context membership
- `src/pages/player/MyClubRequestsPage.jsx` — revision scope fix, guard wiring
- `src/pages/player/guards/ClubActiveMembershipGuard.jsx` — skeleton, membership provider
- `src/pages/player/guards/ClubMembershipRequestsGuard.jsx` — permission probe, 403 only
- `src/pages/player/myClub/MyClubMembershipRequestsPanel.jsx` — V2 pending load
- `src/features/club/services/clubActiveMembershipService.js` — cache/dedupe
- `src/features/club/services/clubMembershipRequestService.js` — V2 list pending
- `src/auth/menuAccess.js` — unified landing
- `src/config/v5Menu/clubCoachingMenu.js` — Khám phá CLB nav
- `scripts/verify-phase42j-staging-qa.mjs`
- `package.json` — 5.3.29

---

## Rollback

See `docs/v5/PHASE_42J1_ROLLBACK.md`.

---

## Await GO DEPLOY 42J.1

Before Production:
1. Commit `5.3.29` changes.
2. Add `STAGING_CASHIER_PASSWORD` / `STAGING_SUPER_ADMIN_PASSWORD` to `.env.staging-qa.local` and re-run cases 1 & 4 with real accounts.
3. Promote Preview after stakeholder sign-off.
4. Apply same SQL parity on Production (42I.1 already on prod per audit check).
