# Production Browser Acceptance Runbook

**Program:** PICK_VN Canonical Navigation
**Mode:** Runbook only — **do not execute** until `PRODUCTION_BROWSER_ACCEPTANCE_GO=YES` bound to this package
**Host:** `https://pickvn.app` (Vercel Production)
**Flag:** `VITE_CANONICAL_APP_SHELL_ENABLED`
**Source baseline SHA:** `1bcc4dc729dd53027de1fac1cf39001ea5d29f4b`
**Evidence recorder:** Le Phong
**Devices:** Desktop (D), Tablet (T), Mobile (M)

Policy: prefer no-write / minimum-write. No SQL. No Auth provisioning. No credentials in evidence. Prefer Production URL screenshots showing host.

**Operating mode:** `OWNER_ONLY_CONTROLLED_PILOT`
**Required identities for execution (when authorized):** SUPER_ADMIN (`SUPER_ADMIN_TEST_REQUIRED=YES`) and public unauthenticated (`PUBLIC_UNAUTHENTICATED_TEST_REQUIRED=YES`).

Identity-dependent cells covered by Owner waiver are marked **`WAIVED_BY_OWNER`**. Do **not** mark them PASS. Waivers expire before any non-Owner user or second tenant is enabled.

---

## Stages

| Stage | Code | When |
|-------|------|------|
| Pre-activation | PRE | Flag still ABSENT/OFF; before any Production flag change |
| Activation-window | ACT | After authorized flag TRUE + Production redeploy |
| Post-activation | POST | During monitoring window (interval 5 min, duration 60 min) |
| Rollback verification | RB | If rollback triggered or Owner-authorized rollback rehearsal |

---

## PRE — Pre-activation (flag ABSENT/OFF)

| ID | Check | D | T | M | Identity | Result status |
|----|-------|:-:|:-:|:-:|----------|---------------|
| PRE-01 | Live attest Production flag ABSENT/OFF in Vercel | ✓ | — | — | Operator | PENDING (at window) |
| PRE-02 | Confirm current Production deployment SHA | ✓ | — | — | Operator | PENDING (at window) |
| PRE-03 | Load Production URL → `legacy-app-shell` present | ✓ | ✓ | ✓ | Public | PENDING (at window) |
| PRE-04 | Canonical shell absent | ✓ | ✓ | ✓ | Public | PENDING (at window) |
| PRE-05 | Public routes: `/home`, `/clubs`, `/courts`, `/tournaments` | ✓ | ✓ | ✓ | Public unauthenticated | PENDING (at window) |
| PRE-06 | Unauthenticated protected route → login/deny (no redirect loop) | ✓ | ✓ | ✓ | Public unauthenticated | PENDING (at window) |
| PRE-07 | Screenshot + deployment id evidence pack | ✓ | — | — | Operator | PENDING (at window) |

**STOP** if PRE-01–PRE-04 fail.

---

## ACT — Activation-window checks

### Shell exclusivity and stability

| ID | Check | D | T | M | Identity | Result status |
|----|-------|:-:|:-:|:-:|----------|---------------|
| ACT-01 | `canonical-app-shell` present | ✓ | ✓ | ✓ | Public / SUPER_ADMIN as applicable | PENDING (at window) |
| ACT-02 | `legacy-app-shell` absent | ✓ | ✓ | ✓ | Public / SUPER_ADMIN as applicable | PENDING (at window) |
| ACT-03 | No dual shell markers (shell exclusivity) | ✓ | ✓ | ✓ | Public / SUPER_ADMIN as applicable | PENDING (at window) |
| ACT-04 | White-screen detection = 0 | ✓ | ✓ | ✓ | Any loaded page | PENDING (at window) |
| ACT-05 | Console errors = 0 (material app errors) | ✓ | ✓ | ✓ | Any loaded page | PENDING (at window) |

### Navigation behaviors

| ID | Check | D | T | M | Identity | Result status |
|----|-------|:-:|:-:|:-:|----------|---------------|
| ACT-10 | Direct navigation / deep links (dashboard + 2 protected + 1 public) | ✓ | ✓ | ✓ | SUPER_ADMIN / Public | PENDING (at window) / identity-gated where protected |
| ACT-11 | Browser refresh retains route + shell | ✓ | ✓ | ✓ | SUPER_ADMIN / Public | PENDING (at window) |
| ACT-12 | Browser back / forward history | ✓ | ✓ | ✓ | SUPER_ADMIN / Public | PENDING (at window) |
| ACT-13 | Menu expansion (Tournament, Rating, etc.) | ✓ | ✓ | ✓ | SUPER_ADMIN | PENDING (at window) |
| ACT-14 | Mobile drawer open/close + overlay; Escape if feasible | — | — | ✓ | SUPER_ADMIN / Public | PENDING (at window) |
| ACT-15 | Tablet layout (drawer vs sidebar) | — | ✓ | — | SUPER_ADMIN / Public | PENDING (at window) |

### Route classes and identities

| ID | Check | D | T | M | Identity | Result status |
|----|-------|:-:|:-:|:-:|----------|---------------|
| ACT-20 | Unauthenticated public routes reachable | ✓ | ✓ | ✓ | Public unauthenticated (`AVAILABLE`) | PENDING (at window) |
| ACT-21 | Authenticated SUPER_ADMIN routes allow | ✓ | ✓ | ✓ | SUPER_ADMIN (`EXISTING_OWNER_ACCOUNT`) | PENDING (at window) |
| ACT-22 | Selected non-admin allow routes | ✓ | ✓ | ✓ | Non-admin allow | **WAIVED_BY_OWNER** |
| ACT-23 | Selected non-admin deny routes | ✓ | ✓ | ✓ | Non-admin deny | **WAIVED_BY_OWNER** |
| ACT-24 | Tenant-isolation denial | ✓ | ✓ | ✓ | Tenant isolation | **WAIVED_BY_OWNER** |

### Critical feature checks

| ID | Check | D | T | M | Identity | Result status |
|----|-------|:-:|:-:|:-:|----------|---------------|
| ACT-30 | Tournament Engine — authorized allow | ✓ | ✓ | ✓ | SUPER_ADMIN and/or non-admin allow | SUPER_ADMIN path PENDING (at window); non-admin path **WAIVED_BY_OWNER** |
| ACT-31 | Tournament Engine — unauthorized deny | ✓ | ✓ | ✓ | Non-admin deny | **WAIVED_BY_OWNER** |
| ACT-32 | Rating V5 — admin allow | ✓ | ✓ | ✓ | SUPER_ADMIN | PENDING (at window) |
| ACT-33 | Rating V5 — non-admin deny | ✓ | ✓ | ✓ | Non-admin deny | **WAIVED_BY_OWNER** |
| ACT-34 | Private Pairing — admin allow | ✓ | ✓ | ✓ | SUPER_ADMIN | PENDING (at window) |
| ACT-35 | Private Pairing — non-admin deny | ✓ | ✓ | ✓ | Non-admin deny | **WAIVED_BY_OWNER** |

### Accessibility

| ID | Check | D | T | M | Identity | Result status |
|----|-------|:-:|:-:|:-:|----------|---------------|
| ACT-40 | Keyboard navigation: Tab/Shift+Tab, open drawer/menu, Escape closes + focus restore | ✓ | ✓ | ✓ | SUPER_ADMIN / Public | PENDING (at window) |
| ACT-41 | High contrast / forced-colors smoke | ✓ | ✓ | ✓ | SUPER_ADMIN / Public | PENDING (at window) |
| ACT-42 | Accessible names on primary nav controls | ✓ | ✓ | ✓ | SUPER_ADMIN / Public | PENDING (at window) |

---

## POST — Post-activation monitoring window

| ID | Check | Interval | Duration | Result status |
|----|-------|----------|----------|---------------|
| POST-01 | Spot-check shell exclusivity | every 5 minutes | 60 minutes | PENDING (at window) |
| POST-02 | Confirm no unexpected Production env drift | every 5 minutes | 60 minutes | PENDING (at window) |
| POST-03 | Confirm no uncontrolled `main` merge Production deploy (OBS-P5-PM-01) under merge freeze | continuous awareness | 60 minutes | PENDING (at window) |
| POST-04 | Capture final evidence: screenshots, deployment id, flag value, SHA | end of window | — | PENDING (at window) |
| POST-05 | Record observations — do not silently expand scope | as observed | 60 minutes | PENDING (at window) |

---

## RB — Rollback verification

| ID | Check | D | T | M | Result status |
|----|-------|:-:|:-:|:-:|---------------|
| RB-01 | Production flag set OFF or removed | ✓ | — | — | PENDING (if triggered) |
| RB-02 | Production redeploy completed | ✓ | — | — | PENDING (if triggered) |
| RB-03 | `legacy-app-shell` present; canonical absent | ✓ | ✓ | ✓ | PENDING (if triggered) |
| RB-04 | White screen = 0 | ✓ | ✓ | ✓ | PENDING (if triggered) |
| RB-05 | Public + one authenticated SUPER_ADMIN smoke | ✓ | ✓ | ✓ | PENDING (if triggered) |
| RB-06 | Evidence pack closed | ✓ | — | — | PENDING (if triggered) |

---

## Pass criteria (activation window — when authorized)

- Canonical shell exclusive when flag ON
- Dual shell absent
- White screens = **0**
- Console errors = **0** (material)
- Public routes reachable unauthenticated
- SUPER_ADMIN protected routes allow (**required**)
- Public unauthenticated routes reachable (**required**)
- Unauthorized / tenant isolation deny proven **or** explicit Owner waiver bound (`WAIVED_BY_OWNER` for this pilot)
- Critical feature allow cells complete for SUPER_ADMIN; non-admin deny cells `WAIVED_BY_OWNER` for this pilot

Identity-dependent waived cells remain **`WAIVED_BY_OWNER`**. They are not PASS. Before broader rollout: run non-admin allow/deny and tenant-isolation tests.

---

## Explicit non-execution (this package authoring)

Browser acceptance is **not** performed by this authoring. `PRODUCTION_BROWSER_ACCEPTANCE_GO` remains **NO**.
