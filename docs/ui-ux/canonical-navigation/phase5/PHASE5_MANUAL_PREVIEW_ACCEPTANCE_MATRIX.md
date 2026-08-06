# Phase 5 Manual Preview Acceptance Matrix

**Program:** PICK_VN Canonical Navigation  
**Phase:** 5 — Evidence classification from Owner screenshots  
**PR:** #385 · SHA `7217e8fb3da06cee1ee0940fa665fe694230131f`  
**Flag:** Preview ON · Role demonstrated: Staging SUPER_ADMIN  

Machine-readable: [`PHASE5_MANUAL_PREVIEW_ACCEPTANCE_MATRIX.json`](./PHASE5_MANUAL_PREVIEW_ACCEPTANCE_MATRIX.json)

Classification legend: `PASS` · `PASS_WITH_OBSERVATION` · `WAIVED` · `NOT_TESTED` · `FAIL`

---

## A. Demonstrated Owner evidence

| ID | Route / surface | Classification | Evidence |
|----|-----------------|----------------|----------|
| D-01 | Desktop `/` dashboard (shell) | **PASS_WITH_OBSERVATION** | Canonical shell + left nav; OBS-UI-01 |
| D-02 | Menu GIẢI ĐẤU expand | **PASS** | Daily Play + Trọng tài visible |
| D-03 | `/tournament/daily/tournament-1786001834313` | **PASS_WITH_OBSERVATION** | Renders; OBS-DATA-01 |
| D-04 | Menu RATING & XẾP HẠNG expand | **PASS** | Listed leaves visible |
| D-05 | `/player/skill-assessment` | **PASS** | Renders; no authz error |
| D-06 | `/players/skill` | **PASS_WITH_OBSERVATION** | Renders; empty data OK; OBS-UI-01 |
| D-07 | `/messages` | **PASS_WITH_OBSERVATION** | Renders; OBS-RUNTIME-01 |
| D-08 | `/crm/messages` | **PASS_WITH_OBSERVATION** | No redirect to `/messages`; OBS-RUNTIME-02 |
| D-09 | B01 separation invariant | **PASS** | Dual routes; 0 redirects |
| M-01 | Mobile dashboard 400×858 | **PASS** | Top + bottom nav |
| M-02 | Mobile drawer/menu | **PASS** | Overlay + canonical nav |

---

## B. Public / catalog (planned matrix)

| ID | Route | Classification | Notes |
|----|-------|----------------|-------|
| P-01 | `/` | **PASS_WITH_OBSERVATION** | Covered by D-01 (authed dashboard) |
| P-02 | `/home` | **NOT_TESTED** | |
| P-03 | `/clubs` | **NOT_TESTED** | |
| P-04 | `/courts` | **NOT_TESTED** | |
| P-05 | `/tournaments` | **NOT_TESTED** | |
| P-06 | `/tournaments/` | **NOT_TESTED** | |

---

## C. Messaging (OD-B01)

| ID | Route | Classification | Notes |
|----|-------|----------------|-------|
| M-01 | `/messages` | **PASS_WITH_OBSERVATION** | = D-07 |
| M-02 | `/crm/messages` | **PASS_WITH_OBSERVATION** | = D-08 |
| M-B01 | Separation / no redirect | **PASS** | = D-09 |

---

## D. Tournament Engine (protected family)

| ID | Case | Classification |
|----|------|----------------|
| E-01 | Authorized engine tab | **NOT_TESTED** |
| E-02 | Permission denied | **NOT_TESTED** |
| E-03 | Ownership/tenant denied | **NOT_TESTED** |
| E-04 | Unauthenticated | **NOT_TESTED** |
| E-05…E-10 | Other engine tabs | **NOT_TESTED** |
| E-11 | Catalog vs nested | **NOT_TESTED** |
| LEG-01 | Legacy Daily Play retain (flag ON menu may hide hubs) | **PASS_WITH_OBSERVATION** | Deep link D-03 works |

---

## E. Rating V5 shadow (OD-B03)

| ID | Case | Classification |
|----|------|----------------|
| R-01 | SUPER_ADMIN `/player/skill-assessment-v5` flag OFF | **NOT_TESTED** |
| R-02 | SUPER_ADMIN flag ON | **NOT_TESTED** |
| R-03 | PLATFORM_ADMIN | **NOT_TESTED** (equivalent admin covered only for non-shadow pages) |
| R-04…R-07 | PLAYER / unrelated / unauth | **NOT_TESTED** |
| SA-01 | `/player/skill-assessment` (non-shadow) | **PASS** | = D-05 |

---

## F. Private Pairing

| ID | Case | Classification |
|----|------|----------------|
| PP-01…PP-03 | Admin / unauthorized / tenant | **NOT_TESTED** |

---

## G. Shell / devices / a11y

| ID | Check | Classification |
|----|-------|----------------|
| S-01 | Canonical shell exclusive (flag ON) | **PASS** | Demonstrated desktop/mobile |
| S-02 | Dual shell = 0 | **PASS** | No dual shell observed |
| S-03 | Menu count 76 | **NOT_TESTED** | Not counted in screenshots |
| S-04 | Contextual 7 | **NOT_TESTED** | |
| S-05 | Duplicates 0 | **NOT_TESTED** | B01 separation PASS only |
| S-06 | Registry 179/179 | **NOT_TESTED** | Automated suite territory |
| S-07 | Inter CSS | **NOT_TESTED** | |
| S-08 | Console errors = 0 (full) | **NOT_TESTED** | Owner screenshot: no visible red errors only |
| DEV-DESK | Desktop | **PASS_WITH_OBSERVATION** | OBS-UI-01 |
| DEV-MOB | Mobile | **PASS** | |
| DEV-TAB | Tablet | **NOT_TESTED** | |
| A11Y-KB | Keyboard-only | **NOT_TESTED** | |
| A11Y-HC | High contrast ON/OFF | **NOT_TESTED** | |
| RB-01 | Flag OFF rollback | **NOT_TESTED** | Pending OD-P5-ROLLBACK execution |

---

## H. Roles

| Role | Classification |
|------|----------------|
| SUPER_ADMIN | **PASS** |
| PLATFORM_ADMIN-equivalent | **PASS** (via SUPER_ADMIN) |
| COACH | **WAIVED** (`WAIVED_WITH_KNOWN_SCHEMA_GAP`) |
| CLUB_MANAGER | **NOT_TESTED** |
| REFEREE | **NOT_TESTED** |
| PLAYER | **NOT_TESTED** |
| VENUE_OWNER | **NOT_TESTED** |
| VENUE_MANAGER | **NOT_TESTED** |
| Unauthenticated | **NOT_TESTED** |

---

## Counts

| Classification | Rows in this matrix |
|----------------|--------------------:|
| PASS | 8 |
| PASS_WITH_OBSERVATION | 6 |
| WAIVED | 1 (COACH role) |
| NOT_TESTED | remainder |
| FAIL | **0** |
