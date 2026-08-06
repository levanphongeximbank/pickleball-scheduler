# Phase 4 Test Plan — Legacy Redirect & Cutover Readiness

**Program:** PICK_VN Canonical Navigation  
**Phase:** 4 — Audit / planned matrix (no tests executed in this task)  
**Fresh `origin/main` SHA:** `6ece104677ec1db4ba1b19bc666a1a41ac2c2a93`  
**Verdict:** `CANONICAL_NAVIGATION_PHASE4_READY_WITH_BLOCKERS`

Machine-readable twin: [`PHASE4_TEST_PLAN.json`](./PHASE4_TEST_PLAN.json)

---

## Coverage checklist

| Area | Covered in matrix |
|------|-------------------|
| Canonical route redirects | YES |
| Query preservation | YES |
| Hash preservation | YES |
| RBAC | YES |
| Unauthorized access | YES |
| Unauthenticated access | YES |
| Direct deep links | YES |
| Browser back | YES |
| Invalid parameters | YES |
| Menu/search uniqueness | YES |
| Breadcrumb correctness | YES |
| Flag OFF | YES |
| Flag ON | YES |
| Rollback | YES |
| Desktop | YES |
| Tablet | YES |
| Mobile | YES |
| Accessibility | YES |
| No console errors | YES |

---

## Proposed test files (implementation phase)

1. `tests/canonical-shell-phase4-redirects.test.js`  
2. `tests/canonical-shell-phase4-b03-guard.test.js`  
3. `tests/canonical-shell-phase4-tournament-authz.test.js`  
4. `tests/ui/canonical-shell-phase4-a11y.ui.test.jsx`  

Proposed test file count: **4**

---

## Matrix

### B01 — Messages

| ID | Title | Flag | Viewports | Required | Gate |
|----|-------|------|-----------|----------|------|
| T-B01-01 | Owner reconfirm gate before redirect | any | n/a | YES | BLK-B01-SEMANTIC |
| T-B01-02 | `/crm/messages` sole canonical menu/search authority | ON | desktop, tablet, mobile | YES | — |
| T-B01-03 | `/messages` absent from canonical menu/search | ON | desktop, mobile | YES | — |
| T-B01-04 | If redirect approved: `replace` + query + hash preservation | both | desktop, mobile | YES | owner_reconfirm |
| T-B01-05 | If redirect approved: browser Back skips legacy | both | desktop, mobile | YES | owner_reconfirm |
| T-B01-06 | Unauthenticated access to legacy and target | both | desktop | YES | — |
| T-B01-07 | RBAC denied CRM after redirect (if implemented) | both | desktop | YES | owner_reconfirm |
| T-B01-08 | COMMS MessagingExperience regression if not collapsed | OFF | desktop, mobile | YES | — |

### B02 — Tournament

| ID | Title | Flag | Viewports | Required | Gate |
|----|-------|------|-----------|----------|------|
| T-B02-01 | No invented redirects for unmapped `/tournament/*` | both | desktop | YES | — |
| T-B02-02 | Canonical plural engine deep links with valid ID | ON | desktop, tablet, mobile | YES | — |
| T-B02-03 | Invalid/missing `tournamentId` handling | ON | desktop | YES | — |
| T-B02-04 | Unauthorized engine access (RBAC on) | ON | desktop | YES | — |
| T-B02-05 | Plural routes not public when auth production on | ON | desktop | YES | BLK-PLURAL-AUTHZ |
| T-B02-06 | Legacy mode deep links still work (retain) | both | desktop, mobile | YES | — |
| T-B02-07 | Query/hash preservation only for proven redirects | both | desktop | YES | — |
| T-B02-08 | Menu/search uniqueness: no `/tournament/*` under flag ON | ON | desktop, mobile | YES | — |
| T-B02-09 | Breadcrumb correctness for engine tabs | ON | desktop | YES | — |

### B03 — Shadow

| ID | Title | Flag | Viewports | Required | Gate |
|----|-------|------|-----------|----------|------|
| T-B03-01 | V5 hidden from menu/search flag ON | ON | desktop, mobile | YES | — |
| T-B03-02 | V5 not exposed by rating flag alone in any shell | both | desktop, mobile | YES | — |
| T-B03-03 | Non-SUPER_ADMIN direct URL denied after guard | both | desktop | YES | BLK-B03-GUARD |
| T-B03-04 | SUPER_ADMIN direct URL allowed; no redirect | both | desktop | YES | — |

### Shell / flag / rollback

| ID | Title | Flag | Viewports | Required |
|----|-------|------|-----------|----------|
| T-SHELL-01 | Flag absent/false-like = legacy shell only | OFF | desktop, tablet, mobile | YES |
| T-SHELL-02 | Flag ON = canonical shell only; no dual shell | ON | desktop, tablet, mobile | YES |
| T-SHELL-03 | Rollback flag OFF requires no migration | OFF | desktop | YES |
| T-SHELL-04 | Inter CSS not applied under flag OFF | OFF | desktop | YES |

### Accessibility / cross-cutting

| ID | Title | Flag | Viewports | Required | Notes |
|----|-------|------|-----------|----------|-------|
| T-A11Y-01 | Drawer Escape focus restore (existing) | ON | mobile | YES | Phase 3 covered |
| T-A11Y-02 | Shift+Tab focus trap observation | ON | mobile | NO | Observation only |
| T-X-01 | No console errors on canonical deep links | ON | desktop, mobile | YES | — |
| T-X-02 | Browser back after proven redirects | both | desktop, mobile | YES | — |
| T-X-03 | Production flag remains OFF attestation | OFF | n/a | YES | Docs/env check |

---

## Execution notes

1. Do not run Preview flag-ON certification until blockers BLK-B01-SEMANTIC, BLK-B02-NO-MAP (scope discipline), BLK-B03-GUARD, and BLK-PLURAL-AUTHZ are closed or explicitly waived by owner.  
2. B01 redirect cases remain gated on owner reconfirm.  
3. B02 tests assert **retention** of unmapped legacy routes, not redirects.  
4. Production remains flag OFF; no Production GO in this phase.

---

## Safety

| Check | Value |
|-------|------:|
| Tests executed in this audit task | 0 |
| Runtime code changed | 0 |
| Production mutations | 0 |
| Commit / push / PR | NO |
