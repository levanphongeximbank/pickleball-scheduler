# Production Browser Acceptance Plan

**Program:** PICK_VN Canonical Navigation  
**Mode:** Plan only — do not execute in this audit  
**Host:** Vercel Production (confirm before run)  
**Flag:** `VITE_CANONICAL_APP_SHELL_ENABLED`  
**Policy:** Prefer no-write / minimum-write. No SQL. No Auth provisioning unless Owner GO. Credentials never in evidence.

---

## Objectives

Prove Production canonical shell is exclusive, navigable, and safe across devices and history behaviors after controlled flag-ON redeploy — and prove legacy restore after rollback.

Pass criteria (activation window):

- Canonical shell visible when flag ON  
- Dual shell absent  
- White screens = **0**  
- Console errors = **0** (material app errors; ignore known third-party noise if Owner documents)  
- Public routes reachable unauthenticated  
- Protected routes enforce authz  
- Unauthorized access denied without privilege bypass  

---

## A. Pre-activation checks (flag still OFF/absent)

| ID | Check | Desktop | Tablet | Mobile | Write? |
|----|-------|:-------:|:------:|:------:|:------:|
| PRE-01 | Live attest Production flag OFF/absent in Vercel | ✓ | — | — | No |
| PRE-02 | Confirm current Production deployment SHA | ✓ | — | — | No |
| PRE-03 | Load Production URL → `legacy-app-shell` present | ✓ | ✓ | ✓ | No |
| PRE-04 | Canonical shell absent | ✓ | ✓ | ✓ | No |
| PRE-05 | Public routes: `/home`, `/clubs`, `/courts`, `/tournaments` | ✓ | ✓ | ✓ | No |
| PRE-06 | Unauthenticated protected route → login/deny (no loop) | ✓ | ✓ | ✓ | No |
| PRE-07 | Screenshot + deployment id evidence pack | ✓ | — | — | No |

**STOP** if PRE-01–PRE-04 fail.

---

## B. Activation-window checks (after flag ON + Production redeploy)

### B1 — Shell exclusivity

| ID | Check | Devices |
|----|-------|---------|
| ACT-01 | `canonical-app-shell` present | D/T/M |
| ACT-02 | `legacy-app-shell` absent | D/T/M |
| ACT-03 | No dual shell markers | D/T/M |
| ACT-04 | White screen = 0 | D/T/M |
| ACT-05 | Console errors = 0 (material) | D/T/M |

### B2 — Navigation behaviors

| ID | Check | Devices | Notes |
|----|-------|---------|-------|
| ACT-10 | Direct deep links (dashboard + 2 protected + 1 public) | D/T/M | No-write |
| ACT-11 | Browser refresh on deep link retains route + shell | D/T/M | Phase 5 gap |
| ACT-12 | Back / forward history | D/T/M | Phase 5 gap |
| ACT-13 | Menu expansion (Tournament, Rating, etc.) | D/T/M | Read-only |
| ACT-14 | Mobile drawer open/close + overlay | M | Keyboard Escape if feasible |
| ACT-15 | Tablet layout (drawer vs sidebar) | T | Phase 5 NOT_TESTED |

### B3 — Route classes

| ID | Check | Identity | Write? |
|----|-------|----------|:------:|
| ACT-20 | Public catalog routes | Unauthenticated | No |
| ACT-21 | Protected route allow (authorized role) | Owner-bound Production identity | Prefer No |
| ACT-22 | Unauthorized route deny | Lower-privilege or wrong tenant | No |
| ACT-23 | B01: `/messages` and `/crm/messages` do not collapse incorrectly | Authorized | No |
| ACT-24 | B03 shadow `/player/skill-assessment-v5` (admin allow / non-admin deny) | Per matrix | No |
| ACT-25 | Engine protected routes deny for unauthorized | Per matrix | No |
| ACT-26 | Private Pairing hidden/denied for non-admin | Per matrix | No |

### B4 — Accessibility

| ID | Check |
|----|-------|
| ACT-30 | Keyboard: open drawer/menu, Tab/Shift+Tab, Escape closes + focus restore |
| ACT-31 | High contrast / forced-colors smoke (Phase 5 gap) |
| ACT-32 | Accessible names present on primary nav controls |

### B5 — Role matrix (minimum Production-safe)

Execute only with Owner-bound Production identities:

| Role | Minimum cells |
|------|---------------|
| SUPER_ADMIN / PLATFORM_ADMIN-eq | Full shell + B03 allow + pairing visibility per flags |
| VENUE_OWNER | Menu subset + Engine ownership allow/deny |
| VENUE_MANAGER | Menu subset + deny admin-only |
| CLUB_OWNER or CLUB_MANAGER | Club-scope leaves |
| REFEREE | Referee zone; deny Engine manage |
| PLAYER | Player leaves; deny admin/pairing |
| Unauthenticated | Public only |
| COACH | Skip if waiver continues; else Owner GO required |

---

## C. Post-activation checks (monitoring window)

| ID | Check |
|----|-------|
| POST-01 | Spot-check shell exclusivity every N minutes (Owner-defined) |
| POST-02 | Confirm no unexpected Production env drift |
| POST-03 | Confirm no unrelated merge/deploy entered window without Owner control (OBS-P5-PM-01) |
| POST-04 | Capture final evidence: screenshots, deployment id, flag value, SHA |
| POST-05 | Record observations (OBS-UI-01 etc.) — do not silently expand scope |

---

## D. Rollback verification (if triggered or rehearsed)

| ID | Check |
|----|-------|
| RB-01 | Production flag set OFF/absent |
| RB-02 | Production redeploy completed |
| RB-03 | `legacy-app-shell` present; canonical absent |
| RB-04 | White screen = 0 |
| RB-05 | Public + one protected login smoke |
| RB-06 | Evidence pack closed |

---

## Evidence rules

- Prefer Production URL screenshots showing host  
- Never paste passwords/tokens  
- Mark NOT_TESTED explicitly  
- Do not claim PASS for deferred observations without Owner acceptance  

## Non-goals

- Feature activation of messaging/CRM/coaching  
- Schema fixes for COACH  
- SQL / Auth mutations  
- Promoting Preview to Production as a substitute for flag bake
