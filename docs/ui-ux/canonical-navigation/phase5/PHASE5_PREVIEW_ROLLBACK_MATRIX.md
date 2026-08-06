# Phase 5 Preview Rollback Matrix

**Program:** PICK_VN Canonical Navigation  
**Phase:** 5 — OD-P5-ROLLBACK evidence  
**PR:** #385 · HEAD `640d18e185de05c9aebf75050d21f2405a2412d7`  
**Verdict linked:** `CANONICAL_NAVIGATION_PHASE5_PREVIEW_ROLLBACK_PASS`

Machine-readable: [`PHASE5_PREVIEW_ROLLBACK_MATRIX.json`](./PHASE5_PREVIEW_ROLLBACK_MATRIX.json)

---

## A. Flag / deploy controls

| ID | Check | Expected | Observed | Classification |
|----|-------|----------|----------|----------------|
| RB-01 | Preview `VITE_CANONICAL_APP_SHELL_ENABLED` | `false` / OFF | `false` | **PASS** |
| RB-02 | Change scope | Preview only | Preview only | **PASS** |
| RB-03 | Preview redeploy | Performed | Performed | **PASS** |
| RB-04 | Production env | Unchanged | Unchanged | **PASS** |
| RB-05 | Production deployment | Unchanged | Unchanged | **PASS** |
| RB-06 | Production promote | Not performed | Not performed | **PASS** |

---

## B. Shell exclusivity after rollback

| ID | Check | Expected | Observed | Classification |
|----|-------|----------|----------|----------------|
| RB-10 | Legacy shell restored | YES | YES | **PASS** |
| RB-11 | Canonical shell visible | NO | NO | **PASS** |
| RB-12 | Dual shell | 0 | 0 (canonical absent) | **PASS** |
| RB-13 | Legacy branding V5.0 | Present | Present | **PASS** |
| RB-14 | Legacy left navigation | Visible | Visible | **PASS** |
| RB-15 | White screen | NO | NO | **PASS** |

---

## C. Navigation sample

| ID | Route | Preview URL | Production URL | Classification |
|----|-------|:-----------:|:--------------:|----------------|
| RB-20 | `/tournament/create` | YES | NO | **PASS** |

---

## D. Out of scope / not claimed

| ID | Item | Classification |
|----|------|----------------|
| RB-30 | Full route regression under flag OFF | **NOT_TESTED** (single-route evidence sufficient for rollback gate) |
| RB-31 | Multi-role flag OFF menus | **NOT_TESTED** |
| RB-32 | Re-enable flag ON without new evidence | **NOT_TESTED** |
| RB-33 | Phase 5 merge / Production enablement | **NOT_TESTED** / **FORBIDDEN** |

---

## Counts

| Classification | Count |
|----------------|------:|
| PASS | 13 |
| NOT_TESTED | 4 |
| FAIL | **0** |
| WAIVED | 0 |
