# REFEREE V5-R1B — Engine Extraction Proposal

**Phase:** R1-B  
**Date:** 2026-07-13  
**Status:** PROPOSAL ONLY — không tạo file code.

---

## 1. Pattern đề xuất

**Strategy + Registry** (thay `if/else` trong `applyRallyWin`):

```
matchStateEngine
  → ScoringStrategyRegistry.resolve(state)
  → strategy.applyRallyResult(state, winningTeamId, config)
  → shared postProcess (validateServeSnapshot, checkGameComplete hook)
```

Phù hợp ADR-003 (`side_out_doubles_v1`, `rally_usap_2026_v1`).

---

## 2. Interface đề xuất

```javascript
/**
 * ScoringStrategy — pure functions, no I/O.
 * Selected once per match from state.ruleSetId or state.scoringFormat + matchType.
 */
const ScoringStrategy = {
  /** Validate format at initialize; reject unsupported variants */
  validateFormat(config) {},

  /** Apply one rally outcome; return { ok, state, generatedEvents } */
  applyRallyResult(state, winningTeamId, config) {},

  /** After score change: who serves, serverNumber semantics */
  resolveServiceAfterRally(state, winningTeamId, config) {},

  /** Position updates after rally (may differ from serve resolution) */
  resolvePlayerPositions(state, winningTeamId, config) {},

  /** Optional: auto end-switch milestones */
  checkSideSwitchMilestone(state, config) {},

  /** Game end — may delegate to shared checkGameComplete */
  determineGameCompletion(state, config) {},

  /** UI hints: score call format, show server number? */
  getPresentationHints(state) {},
};
```

### Không nằm trong ScoringStrategy

| Concern | Giữ ở |
|---------|-------|
| Event persistence | Persistence layer |
| Version / sequence | `validateEventPreconditions` |
| Receiver diagonal (given positions) | Shared `receiverResolver` |
| Manual SWITCH_ENDS | `switchEndsEngine` |
| Undo / replay | `undoEngine`, `stateReplayEngine` |
| Finalize / official result | Edge handler |
| Realtime | Realtime module |

---

## 3. Function mapping — từ engine hiện tại

### Giữ SHARED CORE

| Function | File |
|----------|------|
| `applyMatchEvent` (non-scoring events) | `matchStateEngine.js` |
| `validateEventPreconditions` | `matchValidation.js` |
| `validateServeSnapshot` | `matchValidation.js` |
| `resolveReceivingPlayer` | `receiverResolver.js` |
| `recomputeServeContext` | `receiverResolver.js` |
| `applySwitchEnds` | `switchEndsEngine.js` |
| `undoLastEvent` | `undoEngine.js` |
| `rebuildMatchState` | `stateReplayEngine.js` |
| `checkGameComplete` | `sideOutScoringEngine.js` → move to `shared/gameCompletion.js` |

### Chuyển SIDE_OUT STRATEGY

| Function | From |
|----------|------|
| `applySideOutScoringEvent` | `sideOutScoringEngine.js` |
| `activateServer2` | `sideOutScoringEngine.js` |
| `performSideOut` | `sideOutScoringEngine.js` |
| `pickInitialServerForTeam` | `sideOutScoringEngine.js` |
| `applySinglesSideOutEvent` | `singlesScoringEngine.js` |
| `formatSideOutScoreLine` | `scoreboardSelector.js` |

Registry ID: `side_out_doubles_v1`, `side_out_singles_v1`.

### RALLY STRATEGY phải triển khai (mới / thay prototype)

| Method | Source today | Action |
|--------|--------------|--------|
| `applyRallyResult` | `rallyScoringEngine.applyRallyScoringEvent` | **Replace** per USAP 2026 |
| `resolveServiceAfterRally` | inline L32–39 rally engine | Extract; no serverNumber |
| `resolvePlayerPositions` | `switchPartnersOnTeam` (wrong) | **New** score-parity logic |
| `checkSideSwitchMilestone` | L45–50 (broken) | Call `applySwitchEnds` |
| `validateFormat` | `validateInitializeConfig` MLP reject | Extend |
| `getPresentationHints` | `useCourtVisualizerState.formatLabel` | Centralize |
| Singles rally | `applySinglesRallyEvent` | Sub-strategy or branch |

Registry ID: `rally_usap_2026_doubles_v1`, `rally_usap_2026_singles_v1`.

---

## 4. Registry selection

```javascript
function resolveScoringStrategy(state) {
  const key = state.ruleSetId
    ?? `${state.scoringFormat}_${state.matchType}`; // fallback
  // side_out + doubles → SideOutDoublesStrategy
  // rally + doubles → RallyUsap2026DoublesStrategy
}
```

**Set once at initialize** — persist `ruleSetId` in `state_payload` (optional field, no migration).

---

## 5. `applyRallyWin` sau refactor

```javascript
function applyRallyWin(state, teamKey, config) {
  const strategy = resolveScoringStrategy(state);
  const teamId = state.teams[teamKey].teamId;
  return strategy.applyRallyResult(state, teamId, config);
}
```

**Một điểm branch duy nhất.**

---

## 6. Files likely touch (phase sau — không làm trong R1-B)

| File | Change type |
|------|-------------|
| `engines/matchStateEngine.js` | Use registry |
| `engines/sideOutScoringEngine.js` | Wrap as strategy |
| `engines/rallyScoringEngine.js` | Replace implementation |
| `engines/scoringStrategies/` (new) | Strategy modules |
| `constants/scoringFormats.js` | Add `ruleSetId` constants |
| `domain/matchState.js` | Optional `ruleSetId` field |
| `engines/initializeMatchState.js` | Set ruleSetId |
| `selectors/scoreboardSelector.js` | Strategy hints |
| `docs/.../TT5-B_PROVISION_RPC.sql` | Mapping fix (R2+) |
| `tests/referee-v5/rally-*.test.js` (new) | Coverage |

---

## 7. Không đề xuất

- Per-event `scoringFormat` in payload
- Engine selection in Edge handler
- `if (rally)` in `receiverResolver`, `switchEndsEngine`, persistence
- Merge TT `rallyScoringEngine` into V5 live engine (keep validation separate)

**Code changes:** DOCUMENTATION ONLY
