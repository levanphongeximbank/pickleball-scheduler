# Phase 5 Manual Preview Acceptance Report

**Program:** PICK_VN Canonical Navigation  
**Phase:** 5 — Manual Preview acceptance evidence (Owner screenshots)  
**Mode:** Evidence recording only — no runtime/test/env/deploy/SQL/PR changes  
**Generated:** 2026-08-06  
**Draft PR:** [#385](https://github.com/levanphongeximbank/pickleball-scheduler/pull/385)  
**Bound SHA:** `7217e8fb3da06cee1ee0940fa665fe694230131f`  
**Branch:** `feature/canonical-navigation-phase5-preview-acceptance`  
**Environment:** Vercel Preview only · `VITE_CANONICAL_APP_SHELL_ENABLED=true`

Machine-readable: [`PHASE5_MANUAL_PREVIEW_ACCEPTANCE_REPORT.json`](./PHASE5_MANUAL_PREVIEW_ACCEPTANCE_REPORT.json)  
Matrix: [`PHASE5_MANUAL_PREVIEW_ACCEPTANCE_MATRIX.md`](./PHASE5_MANUAL_PREVIEW_ACCEPTANCE_MATRIX.md)

---

## Final Verdict

**`CANONICAL_NAVIGATION_PHASE5_MANUAL_PREVIEW_ACCEPTANCE_PASS_WITH_OBSERVATIONS`**

Owner-demonstrated desktop and mobile Preview sessions on Staging SUPER_ADMIN show canonical shell navigation without white screens or redirect collapse of B01 messaging routes. Observations are UI overlap, Staging data gaps, and feature/CRM runtime unavailability — not navigation shell failures. Large route/role matrix areas remain **NOT_TESTED** and are not claimed PASS.

---

## Identity / binding

| Field | Value |
|-------|-------|
| PR | **#385** (Draft, OPEN) |
| Bound SHA | `7217e8fb3da06cee1ee0940fa665fe694230131f` |
| Worktree HEAD | Matches bound SHA |
| Vercel Preview checks (PR tip) | `verify` SUCCESS; Vercel Preview Comments SUCCESS |
| Netlify first pass | Out of scope (OD-P5-ENV) |
| Login identity | Staging SUPER_ADMIN (PLATFORM_ADMIN-equivalent per Package A) |
| Tenant | `venue-staging-a` |
| Production URL used | **NO** |

---

## Summary counts

| Class | Count |
|-------|------:|
| Desktop checks PASS / PASS_WITH_OBSERVATION | 9 demonstrated surfaces |
| Mobile checks PASS | 2 |
| Routes PASS | 5 |
| Routes PASS_WITH_OBSERVATION | 4 |
| Routes WAIVED | 0 in this evidence set (COACH identity waived separately) |
| Routes NOT_TESTED (planned matrix remainder) | See matrix |
| Routes FAIL | **0** |
| White screens | **0** |
| Visible red console errors (Owner screenshot) | **0 visible** (not a full console audit) |

---

## Demonstrated results

| ID | Surface | Classification | Notes |
|----|---------|----------------|-------|
| D-01 | Desktop Dashboard | **PASS_WITH_OBSERVATION** | Canonical shell + left nav; Preview URL; **OBS-UI-01** |
| D-02 | Tournament menu expand | **PASS** | Daily Play + Trọng tài visible |
| D-03 | Daily Play deep link | **PASS_WITH_OBSERVATION** | `/tournament/daily/tournament-1786001834313`; **OBS-DATA-01** |
| D-04 | Rating menu expand | **PASS** | Skill/review/VPR leaves visible |
| D-05 | `/player/skill-assessment` | **PASS** | Renders; no authz error |
| D-06 | `/players/skill` | **PASS_WITH_OBSERVATION** | Empty Staging OK; **OBS-UI-01** |
| D-07 | `/messages` | **PASS_WITH_OBSERVATION** | Separate route; **OBS-RUNTIME-01** |
| D-08 | `/crm/messages` | **PASS_WITH_OBSERVATION** | No redirect to `/messages`; **OBS-RUNTIME-02** |
| D-09 | B01 separation | **PASS** | Dual routes; 0 redirects |
| M-01 | Mobile dashboard 400×858 | **PASS** | Top bar + bottom nav |
| M-02 | Mobile menu open | **PASS** | Canonical nav + overlay; Preview URL |

---

## Observations

| ID | Class | Summary | Navigation blocker? |
|----|-------|---------|:-------------------:|
| **OBS-UI-01** | UI | Tenant selector text overlap on desktop | **NO** |
| **OBS-DATA-01** | Staging data | Daily Play warning `MISSING_IDENTITY_LINK` / no eligible players | **NO** |
| **OBS-RUNTIME-01** | Runtime feature | `/messages` shows feature not activated | **NO** |
| **OBS-RUNTIME-02** | Runtime CRM | `/crm/messages` shows `CRM_AUTHORITY_UNAVAILABLE` | **NO** |

---

## Identity coverage (this evidence)

| Role | Status |
|------|--------|
| SUPER_ADMIN | **PASS** (tested) |
| PLATFORM_ADMIN-equivalent | **PASS** (via Staging SUPER_ADMIN) |
| COACH | **WAIVED** (`WAIVED_WITH_KNOWN_SCHEMA_GAP`) |
| CLUB_MANAGER | **NOT_TESTED** in screenshots (prior: READY_WITH_LIMITATIONS) |
| REFEREE | **NOT_TESTED** in screenshots (prior: READY_WITH_LIMITATIONS) |
| PLAYER / VENUE_OWNER / VENUE_MANAGER / unauthenticated / others | **NOT_TESTED** |

---

## Not claimed in this evidence

Do **not** treat as PASS from this recording:

- Seven Tournament Engine protected routes + denial cases  
- Rating V5 shadow `/player/skill-assessment-v5` matrix  
- Private Pairing admin route  
- Flag OFF / rollback Preview verification  
- Keyboard-only / high-contrast formal matrix  
- Full console network audit  
- Multi-role menu matrices beyond SUPER_ADMIN  

---

## Production / safety attestation

| Check | Value |
|-------|------:|
| Production touched | **NO** |
| Production flag | OFF_OR_ABSENT |
| Production env changed | **NO** |
| Production redeployed / promoted | **NO** |
| Agent deployments | **0** |
| Env changed by agent | **NO** |
| SQL mutations | **0** |
| Staging mutations | **0** |
| Runtime / test code changes | **NO** |
| Commit / push / PR status change | **NO** |

---

## Next recommended steps (Owner)

1. Optional follow-up: triage OBS-UI-01 / OBS-RUNTIME-* outside Phase 5 nav scope if desired.  
2. Complete remaining NOT_TESTED high-value cells (Engine authz, B03 shadow, rollback) in a later evidence pass **or** explicitly waive.  
3. After Owner satisfaction: OD-P5-ROLLBACK (Preview flag OFF + Preview redeploy only).  
4. Keep PR **#385** Draft until Owner merge decision.
