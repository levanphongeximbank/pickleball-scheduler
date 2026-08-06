# Phase 5 Preview Rollback Report

**Program:** PICK_VN Canonical Navigation  
**Phase:** 5 — Preview rollback evidence (OD-P5-ROLLBACK)  
**Mode:** Evidence recording only — no runtime/test/env/Production/SQL/PR changes by Agent  
**Generated:** 2026-08-06  
**Draft PR:** [#385](https://github.com/levanphongeximbank/pickleball-scheduler/pull/385)  
**Current HEAD:** `640d18e185de05c9aebf75050d21f2405a2412d7`  
**Branch:** `feature/canonical-navigation-phase5-preview-acceptance`

Machine-readable: [`PHASE5_PREVIEW_ROLLBACK_REPORT.json`](./PHASE5_PREVIEW_ROLLBACK_REPORT.json)  
Matrix: [`PHASE5_PREVIEW_ROLLBACK_MATRIX.md`](./PHASE5_PREVIEW_ROLLBACK_MATRIX.md)

---

## Final Verdict

**`CANONICAL_NAVIGATION_PHASE5_PREVIEW_ROLLBACK_PASS`**

Owner executed Preview-scoped flag OFF + Preview-only redeploy. Screenshot evidence on Preview URL shows **legacy shell restored**, canonical shell absent, no white screen, and Production not used. Phase 5 rollback gate **passes**.

This does **not** claim Phase 5 fully closed (flag-ON matrix still has NOT_TESTED cells; PR remains Draft).

---

## Rollback execution (Owner)

| Step | Result |
|------|--------|
| `VITE_CANONICAL_APP_SHELL_ENABLED` Preview value | `true` → **`false`** |
| Scope | **Preview only** |
| Preview-only redeploy | **Performed** |
| Production environment | **Unchanged** |
| Production deployment | **Unchanged** |
| Production promotion | **Not performed** |

---

## Screenshot evidence

| Field | Result |
|-------|--------|
| Preview URL | **YES** |
| Route | `/tournament/create` |
| Legacy shell restored | **YES** |
| Canonical shell visible | **NO** |
| Legacy branding `Pickleball Scheduler Pro V5.0` | **YES** |
| Legacy left navigation | **YES** |
| White screen | **NO** |
| Production URL | **NO** |

Classification: **PASS**

---

## Gate evaluation (OD-P5-ROLLBACK)

| Check | Expected | Observed | Status |
|-------|----------|----------|--------|
| Return Preview flag to OFF/false | YES | YES | **PASS** |
| Redeploy Preview only | YES | YES | **PASS** |
| Legacy shell exclusive | YES | YES | **PASS** |
| Canonical shell absent | YES | YES | **PASS** |
| No white screen | YES | YES | **PASS** |
| Production env unchanged | YES | YES | **PASS** |
| Production deploy unchanged | YES | YES | **PASS** |
| No Production promote | YES | YES | **PASS** |

---

## Binding context

| Item | Value |
|------|-------|
| Prior flag-ON evidence | `CANONICAL_NAVIGATION_PHASE5_MANUAL_PREVIEW_ACCEPTANCE_PASS_WITH_OBSERVATIONS` |
| Trigger decision | OD-P5-TRIGGER Draft PR #385 |
| Rollback decision | OD-P5-ROLLBACK `APPROVED_PREVIEW_ROLLBACK` |
| Production GO | **NO** |

---

## Safety attestation (this recording)

| Check | Value |
|-------|------:|
| Runtime code changed | **NO** |
| Tests changed | **NO** |
| SQL mutations | **0** |
| Staging mutations | **0** |
| Agent deployments | **0** (Owner performed Preview redeploy) |
| Production touched by Agent | **NO** |
| Commit / push / PR Draft change / merge | **NO** |
