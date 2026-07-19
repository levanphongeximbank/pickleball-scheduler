# Club Phase 2G — Production Visual Smoke & Final Closure

**Date:** 2026-07-20  
**Branch:** `feature/club-phase-2g-production-visual-smoke`  
**Base / HEAD:** `f6ae0eec6f962b63df2637e4646f629186dcc6eb` (= `origin/main`)  
**Phase 2F merge ancestry:** `cf32171` (PR #92) · fix commit `29de3b0`  
**Charter:** Production-safe visual smoke certification for Production-reachable Club governance UI after Phase 2F  
**Does not reopen:** Phase 2D writers · Phase 2E read-model architecture · Phase 2F code fixes  
**Historical note:** Roadmap “2G = legacy retirement” is a **different** track; not this charter.

---

## Final verdict

# **PASS_WITH_NOTE**

| Dimension | Result |
|-----------|--------|
| Repository state | **PASS** (clean; branch = latest `origin/main`; Phase 2F ancestor) |
| Production deploy includes Phase 2F | **PASS** (Vercel Production ref `f6ae0ee` after `cf32171`) |
| Automated governance smoke | **PASS** (28/28 Phase 2F · 141/141 Club pack) |
| Public Production shell | **PASS** (`/login` HTTP OK on production alias) |
| Authenticated visual smoke (pages 2–7) | **BLOCKED** — no safe QA login; no browser automation; no customer-data screenshots |
| Production safety | **PASS** (read-only; no SQL; no deploy; no customer mutation; no production code change) |
| Code changes this phase | **NONE** (no UI defect confirmed live) |

---

## Gates

| Gate | Result |
|------|--------|
| Working tree clean at start | PASS |
| Branch from latest `origin/main` only | PASS |
| Phase 2F PR #92 merge ancestor of HEAD | PASS |
| Production-reachable inventory revalidated | PASS (router + Phase 2F inventory) |
| Governance display contracts (code + unit) | PASS |
| Loading / error / empty / retry / missing / stale (code + unit) | PASS |
| Responsive / a11y source contracts | PASS_WITH_NOTE (live pixels blocked; residual gaps logged) |
| Browser console (authenticated) | **NOT_RUN** (auth blocked) |
| Regression Club Home / My Club / Members / Gov / Org | PASS (automated pack) |
| SQL / deploy / PR / merge | **NOT DONE** (forbidden) |

---

## Visual smoke evidence summary

| Surface | Automated / code | Live visual | Screenshots |
|---------|------------------|-------------|-------------|
| `/my-club` | PASS | BLOCKED | Not captured |
| `/my-club?view=members` | PASS | BLOCKED | Not captured |
| `/manage/clubs` | PASS | BLOCKED | Not captured |
| `/manage/clubs/:id` | PASS | BLOCKED | Not captured |
| Organization chart | PASS | BLOCKED | Not captured |
| Governance management panel | PASS | BLOCKED | Not captured |

**Public probe only:** Production `https://pickleball-scheduler-eight.vercel.app/login` and Phase 2F Preview `https://pickleball-scheduler-d5zdbv01w-pickleball-scheduler.vercel.app/login` return the login shell (no authenticated governance UI).

---

## Production safety assessment

- No Production SQL applied  
- No Staging SQL applied  
- No deploy performed  
- No PR opened / merged  
- No Production customer data read beyond public login shell  
- No Production code modified  
- Working tree may contain **docs-only** Phase 2G evidence (this folder)

---

## Remaining risks (non-blocking for automated closure)

See [CLUB_PHASE2G_REMAINING_RISKS.md](./CLUB_PHASE2G_REMAINING_RISKS.md).

Top notes:

1. Authenticated visual / console still unverified live (FU-2G-1).  
2. `GovernanceMemberSelect` still shows `userId` as MenuItem secondary (UUID visible in management selects).  
3. Manage Overview stats cards still use local `getClubStats` (not cloud `activeMemberCount`) — adjacent to governance labels, which remain canonical.  
4. Roadmap Phase 2G (legacy retirement) and Phase 2H (final Production certification) remain open tracks.

---

## Ask of Owner

1. Review `docs/club-phase2/phase2g/`.  
2. Accept **PASS_WITH_NOTE**, or supply a **safe Staging/Preview QA account + synthetic club** to clear authenticated visual smoke (then re-run as FU-2G-1).  
3. Do **not** treat this as roadmap “legacy retirement 2G”.  
4. Open PR only when docs commit is requested (not done here).  
5. Do **not** apply Production SQL from this phase.

## Doc index

1. [REPO_STATE](./CLUB_PHASE2G_REPO_STATE.md)  
2. [QA_ENVIRONMENT](./CLUB_PHASE2G_QA_ENVIRONMENT.md)  
3. [VISUAL_SMOKE](./CLUB_PHASE2G_VISUAL_SMOKE.md)  
4. [GOVERNANCE_CHECKLIST](./CLUB_PHASE2G_GOVERNANCE_CHECKLIST.md)  
5. [STATES_RESPONSIVE_A11Y](./CLUB_PHASE2G_STATES_RESPONSIVE_A11Y.md)  
6. [REGRESSION_AND_TESTS](./CLUB_PHASE2G_REGRESSION_AND_TESTS.md)  
7. [REMAINING_RISKS](./CLUB_PHASE2G_REMAINING_RISKS.md)  
8. [PR_READINESS](./CLUB_PHASE2G_PR_READINESS.md)  
9. [FINAL_CLUB_PHASE_STATUS](./CLUB_PHASE2G_FINAL_CLUB_PHASE_STATUS.md)  
