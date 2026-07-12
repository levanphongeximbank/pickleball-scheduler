# Referee V5-B — Implementation Report

**Date:** 2026-07-12  
**Phase:** V5-B (Pure domain engines + unit tests)  
**Feature flag:** `VITE_REFEREE_V5_ENABLED=false`

---

## 1. Scope delivered

| Area | Status |
|------|--------|
| Match state engine | ✅ |
| Side-out doubles scoring | ✅ |
| Rally scoring (basic) | ✅ (OWNER DECISION REQUIRED for full MLP rules) |
| Singles scoring | ✅ |
| Serve rotation / server 2 | ✅ |
| Receiver resolver | ✅ |
| Diagonal serve direction selector | ✅ |
| Court position / screen mapping | ✅ |
| Switch-ends engine | ✅ |
| Undo + state replay | ✅ |
| UI / RPC / SQL / deploy | ❌ Not in scope |

---

## 2. Module location

```text
src/features/referee-v5/
  constants/
  domain/
  engines/
  selectors/
  flags.js
  index.js

tests/referee-v5/
  referee-v5-engine.test.js
  testHelpers.js
```

Public entry: `src/features/referee-v5/index.js`  
Flag helper: `isRefereeV5Enabled()` → reads `VITE_REFEREE_V5_ENABLED`.

---

## 3. Core API

```javascript
import {
  initializeMatchState,
  applyMatchEvent,
  resolveReceivingPlayer,
  resolveServeDirection,
  logicalPositionToScreenPosition,
  applySwitchEnds,
  rebuildMatchState,
  undoLastEvent,
} from "src/features/referee-v5";
```

Central transition:

```javascript
next = applyMatchEvent(currentState, event, ruleConfig);
```

Undo is separate (append-only `EVENT_REVERTED`):

```javascript
undoLastEvent(state, eventHistory, { initialState, baseState });
```

---

## 4. Architectural compliance

| Rule | Result |
|------|--------|
| Pure functions (no Supabase/localStorage/time/UUID) | ✅ |
| Client emits actions only; server resolves serve/receiver | ✅ |
| Logical vs physical vs screen coordinates separated | ✅ |
| Diagonal cross-court receiver mapping | ✅ |
| Legacy referee module unchanged | ✅ |
| Feature flag off | ✅ |

---

## 5. Known gaps (V5-C+)

1. `UNDO_LAST_EVENT` not wired inside `applyMatchEvent` — use `undoLastEvent()` with event history.
2. Rally scoring MLP rotation rules — **OWNER DECISION REQUIRED**.
3. Timeout/forfeit events increment version only (no domain side-effects yet).
4. No integration with Supabase event store.

---

## 6. Test summary

| Suite | Result |
|-------|--------|
| Mandatory V5-B unit tests (35) | **35/35 PASS** |
| Extra screen-mapping test | **1 PASS** |
| Module lint (`eslint src/features/referee-v5`) | **PASS** |
| Build (`npm run build`) | **PASS** |
| Full repo lint | Pre-existing errors outside module |
| Integration / RLS | **NOT RUN** |

See `V5-B_TEST_RESULTS.md`.

---

## 7. GO / NO-GO

| Gate | Verdict |
|------|---------|
| V5-B domain engines | **GO** — owner review |
| Preview deploy | **NO** |
| Production deploy | **NO** |
| SQL apply | **NOT APPLIED** |

**Recommended next phase:** V5-C — Court Visualizer Prototype (behind feature flag).
