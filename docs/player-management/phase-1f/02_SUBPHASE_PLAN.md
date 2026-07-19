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

**Status:** Implementation evidence in `03_PHASE_1F_A_IMPLEMENTATION_EVIDENCE.md`.

**Stop before 1F-B public surface** until Owner confirms 1F-A ready.

## 1F-B deliverables

| Deliverable | Notes |
|-------------|--------|
| Public profile projector | Fail-closed defaults from `constants/privacy.js` |
| Directory / search filtering | No raw `profiles` exposure |
| Optional public route | Only if projector-backed |

## Deferred (post–1F)

| Item | Original label / note |
|------|------------------------|
| Verification admin | Classification C |
| Link & dedupe | Original 1A “1F” |
| V2 dossier cutover | Classification D partial |
| Blob write retirement | Classification D partial |
