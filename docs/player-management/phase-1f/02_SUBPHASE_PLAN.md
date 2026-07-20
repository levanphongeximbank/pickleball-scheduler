# Phase 1F — Sub-phase Plan

## Order (mandatory)

```
1F-A (UI + self read/write surface)
    →
1F-B (privacy projector + optional public/directory)
```

Do not open public/directory work that bypasses the projector.

## 1F-A deliverables

| Deliverable | Notes |
|-------------|--------|
| Self fetch surfaces foundation fields | Avoid save/reload gaps |
| Edit controls on Athlete self profile | Primary surface for legacy account fields; foundation panel is read-first in 1F-A |
| My Profile alignment | Foundation read panel on both Athlete and My Profile |
| Verification status badge / text | Read-only |
| Tests | UI + service; self verification write still blocked |

**Status:** **Closed** — evidence `03_PHASE_1F_A_IMPLEMENTATION_EVIDENCE.md`.

## 1F-B deliverables

| Deliverable | Notes |
|-------------|--------|
| Public profile projector | Fail-closed defaults from `constants/privacy.js` |
| Directory / search filtering | No raw `profiles` exposure |
| Optional public route | Only if projector-backed |

**Plan freeze:** Owner `APPROVE_PHASE_1F_B_PLAN` — see `04_PHASE_1F_B_PLAN_FREEZE.md`.  
**Branch:** `feature/player-phase-1f-b-privacy-public-projector`  
**Sub-order:** 1F-B1 (projector) → 1F-B2 (facade wire-up) → 1F-B3 (optional public UI).

**Status:**

| Sub-phase | State |
|-----------|--------|
| **1F-B1** | **Closed** — `06_PHASE_1F_B1_IMPLEMENTATION_EVIDENCE.md` |
| **1F-B2** | **Closed** — `07_PHASE_1F_B2_IMPLEMENTATION_EVIDENCE.md` |
| **1F-B3** | **Skipped** (optional) — Owner `CLOSE_PHASE_1F_NOW` |

**Phase closure:** `08_PHASE_1F_CLOSURE.md` — verdict `PHASE_1F_CLOSED`.

## Deferred (post–1F)

| Item | Original label / note | Status |
|------|------------------------|--------|
| Verification admin | Classification **1F-C** | **Deferred** |
| Link & dedupe | Original 1A “1F” | **Deferred** |
| V2 dossier cutover | Classification **1F-D** partial | **Deferred** |
| Blob write retirement | Classification **1F-D** partial | **Deferred** |
