# REFEREE V5-R1C — Rally Strategy Design

**Phase:** R1-C — Architecture & Rules Spec  
**Date:** 2026-07-13  
**Status:** APPROVED (Owner 2026-07-13)  
**Authority:** `V5-R1_OWNER_DECISIONS.md`, ADR-003, R1-B extraction proposal

---

## 1. Design goal

Triển khai USA Pickleball 2026 Provisional Rally (Doubles) như **Scoring Strategy** độc lập, không sửa hành vi Side-Out, không dùng prototype `rallyScoringEngine.js` làm chuẩn.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Shared Match Core (unchanged behavior)      │
│  lifecycle · persistence · undo/replay · realtime        │
│  finalize · official result · validateEventPreconditions │
└───────────────────────────┬─────────────────────────────┘
                            │
              ScoringStrategyRegistry.resolve(state)
                            │
         ┌──────────────────┴──────────────────┐
         ▼                                      ▼
 SideOutDoublesStrategy              Usap2026ProvisionalRallyDoublesStrategy
 (existing sideOutScoringEngine)      (new — R2)
```

### Principles (owner-mandated)

1. **No scattered `if/else`** on `scoringSystem` outside registry + strategy selection.
2. **No silent fallback** Rally → Side-Out.
3. Side-Out strategy **wraps existing engine** — behavior frozen unless bugfix.
4. DreamBreaker / MLP = **separate strategies** — future phases.

---

## 3. Strategy interface

```javascript
/**
 * @typedef {object} ScoringStrategy
 * Pure functions — no I/O.
 */
const ScoringStrategy = {
  id: 'rally_usap_2026_provisional_doubles_v1',

  validateFormat(config) {
    // scoringSystem=RALLY, variant=USAP_2026_PROVISIONAL_RALLY
    // matchType=DOUBLES, freezeRule=NONE, serverNumberRule=NONE
    // pointsToWin in {11,15,21}, winBy=2
  },

  applyRallyResult(state, winningTeamId, config) {
    // Point to winning team (every rally)
    // Service rotation per USAP 2026 provisional doubles
    // Position updates per score parity
    // No serverNumber 1/2 semantics
  },

  resolveServiceAfterRally(state, winningTeamId, config) {},

  resolvePlayerPositions(state, winningTeamId, config) {},

  checkSideSwitchMilestone(state, config) {
    // USAP 2026 end-switch rules — wire applySwitchEnds
  },

  determineGameCompletion(state, config) {
    // pointsToWin + winBy; freezeRule ignored (NONE)
  },

  determineMatchCompletion(state, config) {
    // Early best-of termination
  },

  getPresentationHints(state) {
    // hide server 1/2 badge; rally score line format
  },
};
```

### Not in strategy

| Concern | Owner module |
|---------|--------------|
| Event persist / idempotency | Persistence layer |
| `validateServeSnapshot` | Shared validation (after strategy returns positions) |
| `resolveReceivingPlayer` | `receiverResolver.js` |
| Manual `SWITCH_ENDS` | `switchEndsEngine.js` |
| Undo / replay | `undoEngine`, `stateReplayEngine` |
| Finalize → TT outbox | Edge handler |

---

## 4. Registry

```javascript
// Conceptual — R2 implementation
const ScoringStrategyRegistry = {
  register(strategy) {},
  get(ruleSetId) {},
  resolve(state) {
    // 1. state.ruleSetId
    // 2. scoringSystem + scoringVariant + matchType
    // 3. throw FormatError — never default to side-out
  },
};

const REGISTERED = {
  'side_out_doubles_v1': SideOutDoublesStrategy,
  'rally_usap_2026_provisional_doubles_v1': Usap2026ProvisionalRallyDoublesStrategy,
  // future: rally_singles_v1, dreambreaker_singles_v1, mlp_rally_doubles_v1
};
```

### `matchStateEngine` integration point

**Current (R1-B):**

```javascript
// matchStateEngine.applyRallyWin — if/else on scoringFormat
```

**Target (R2):**

```javascript
const strategy = ScoringStrategyRegistry.resolve(state);
const result = strategy.applyRallyResult(state, winningTeamId, buildRuleConfig(state));
// shared: validateServeSnapshot, append events, check game/match complete
```

---

## 5. USAP 2026 Provisional Rally — doubles behavior spec

### Scoring

- Mỗi rally → đội thắng rally được **1 điểm** (kể cả khi không giao bóng).
- Game kết thúc: `pointsToWin` + `winBy` (default 11, win by 2).
- **No freeze** (`freezeRule = NONE`).

### Service

- **No Server 1 / Server 2** (`serverNumberRule = NONE`).
- `serverNumber` không dùng cho presentation rally.
- Rotation theo USAP 2026 provisional doubles rules (R2 implements from `V5-R1A_OFFICIAL_SOURCES.md`).

### Positions

- Thay thế logic prototype (partner flip sai, side-switch broken).
- Score-parity position rules per official source.
- `checkSideSwitchMilestone` → gọi `applySwitchEnds` khi đạt mốc.

### Match

- `determineMatchCompletion`: early end khi `gamesWon >= ceil(bestOf/2)`.

---

## 6. Prototype vs canonical

| Aspect | `rallyScoringEngine.js` (prototype) | Canonical strategy (R2) |
|--------|-------------------------------------|-------------------------|
| Rule source | Ad-hoc | USAP 2026 provisional |
| Default points | 11 (hardcoded init) | 11 (configurable 15/21) |
| Server 1/2 | Sets serverNumber=1 | NONE |
| Positions | Broken flip | USAP parity rules |
| Side switch | `ENDS_SWITCHED` without apply | Wired milestone |
| Tests | 0 | ≥25 |

**R2 action:** implement new strategy; deprecate direct `applyRallyWin` branch to prototype.

---

## 7. Side-Out strategy (frozen)

| Item | R2 behavior |
|------|-------------|
| `sideOutScoringEngine.js` | Wrap as `SideOutDoublesStrategy` or keep direct call via registry alias |
| Regression | **43** engine+command tests MUST PASS |
| Changes | Bugfix only — no rally leakage |

---

## 8. Replay & finalize

1. Replay loads initial state → `resolve(state)` → same strategy as live.
2. Missing `scoringSystem` on **legacy** match → explicit legacy profile (Side-Out).
3. Missing on **new** match → finalize blocked / error.
4. `ruleSetId` optional but recommended for audit trail.

---

## 9. Out of scope (R2)

- Singles rally strategy
- DreamBreaker strategy
- MLP freeze @20
- `freezeRule` implementation
- UI format picker

---

## 10. Test requirements (R2 gate)

| Suite | Minimum |
|-------|--------|
| Side-out regression | 43 PASS |
| Rally doubles USAP 11/2 | ≥25 new |
| Replay rally match | Included |
| Finalize rally → official result | Included |
| Legacy side-out replay | Included |
| Provision format mapping | Integration test |

---

## 11. References

- `V5-R1C_MATCH_FORMAT_CONTRACT.md`
- `V5-R1B_ENGINE_EXTRACTION_PROPOSAL.md`
- `V5-R1B_MATCH_STATE_ENGINE_AUDIT.md`
- `V5-R1A_OFFICIAL_SOURCES.md`
- `adr/ADR-005-FIRST-RALLY-SCOPE.md`

**Code changes:** DOCUMENTATION ONLY
