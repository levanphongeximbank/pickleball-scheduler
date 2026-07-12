# Referee V5-C — Test Results

**Date:** 2026-07-12

---

## V5-C UI tests (35 + 1 route shell)

**Command:** `npx vitest run tests/ui/referee-v5-c.test.jsx`  
**Result:** **36/36 PASS**

Covers:
- Component display (1–10)
- Rally command wiring (11–13)
- Server 2 / side-out / partner switch (14–17)
- Switch ends (18–19, 29–30)
- Undo UI (20)
- Responsive (21–25)
- Controller integration (26–31)
- MLP reject (32)
- Feature flag off (33)
- Legacy routes preserved (34)
- Singles server label (35)
- Preview route shell (+1)

---

## V5-B engine regression

**Command:** `node --test tests/referee-v5/*.test.js`  
**Result:** **43/43 PASS** (36 V5-B + 7 command)

Includes:
- `UNDO_LAST_EVENT` via `dispatchMatchCommand`
- `UNDO_LAST_EVENT` via `applyMatchEvent` + options

---

## Legacy referee

**Command:** `node --test tests/referee-engine.test.js`  
**Result:** **16/16 PASS**

---

## Build & lint

| Check | Result |
|-------|--------|
| `eslint src/features/referee-v5` | **PASS** |
| `npm run build` | **PASS** |
| Integration DB | **NOT RUN** |
| RLS | **NOT RUN** |

---

## Manual QA

Owner visual acceptance checklist (§20) — **pending owner review** on `/dev/referee-v5` with `VITE_REFEREE_V5_ENABLED=true`.
