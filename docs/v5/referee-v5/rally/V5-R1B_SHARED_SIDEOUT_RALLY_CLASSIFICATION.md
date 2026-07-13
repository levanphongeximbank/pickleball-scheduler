# REFEREE V5-R1B — Shared / Side-Out / Rally Classification

**Phase:** R1-B  
**Date:** 2026-07-13

---

## 1. SHARED CORE

Logic **không phụ thuộc** side-out hay rally — giữ nguyên, không thêm `if (rally)`:

| Module | Files / functions |
|--------|-------------------|
| **Lifecycle** | `initializeMatchState`, `startMatchFromInitialized`, status transitions (PAUSE/RESUME/LOCK) |
| **Event persistence** | `RefereeV5PersistenceService`, `RefereeV5EdgeCommandHandler`, atomic commit RPC |
| **Idempotency** | `match_sync_mutations`, idempotency key handling |
| **Optimistic locking** | `validateEventPreconditions` (version, sequence) |
| **Replay framework** | `stateReplayEngine.rebuildMatchState`, `verifySnapshotMatchesReplay` |
| **Canonical hash** | `canonicalStateHash.js` |
| **Realtime** | `realtimeSyncLogic`, `useRefereeRealtimeSync` (version-only) |
| **Audit** | `auditLog.js` |
| **Official result** | Finalize → `match_result_revisions` → outbox |
| **Authorization** | `refereeV5Authorization`, assignment checks |
| **Receiver diagonal (given correct positions)** | `resolveReceivingPlayer`, `validateServeSnapshot` |
| **Switch ends (manual)** | `applySwitchEnds` |
| **Court display mapping** | `logicalPositionToScreenPosition`, `serveArrowSelector` |
| **Undo framework** | `undoEngine`, `dispatchUndoCommand` |
| **Command vocabulary** | `TEAM_A/B_WON_RALLY`, `START_MATCH`, `SWITCH_ENDS` |

---

## 2. SIDE_OUT STRATEGY

Logic **chỉ** áp dụng khi `scoringFormat === side_out`:

| Concern | Current location |
|---------|------------------|
| Server 1 → Server 2 | `sideOutScoringEngine.activateServer2` |
| Side-out without point | `performSideOut`, receiving-team win branch |
| Point only when serving | `applySideOutScoringEvent` serving branch |
| Partner switch on serving point | `switchPartnersOnTeam` (side-out path) |
| `serverNumber` 1/2 semantics | Init + side-out engine |
| Side-out score line UI | `formatSideOutScoreLine` |
| Domain events `SIDE_OUT`, `SECOND_SERVER_ACTIVATED` | sideOutScoringEngine outputs |
| Singles side-out | `applySinglesSideOutEvent` |
| `sideOutInitialServerSide` config | `buildRuleConfig` |

**Không được** sửa các function này khi thêm rally — **tách** hoặc **delegate** sang strategy.

---

## 3. RALLY STRATEGY NEEDED

Logic **chỉ** áp dụng khi `scoringFormat === rally` (USAP 2026 target):

| Concern | Current state | Target (R1-A) |
|---------|---------------|-----------------|
| Point every rally | `rallyScoringEngine` prototype ✅ | Keep |
| Serve to winner on receiving win | Prototype ✅ | Keep + refine |
| **No Server 1/2** | Partial — still sets serverNumber=1 | Clear/null |
| Score-based player positions | ❌ uses partner flip | USAP 5.B.3 parity |
| Serve box even/odd | ❌ doubles | USAP 14.A.4 |
| Side-out on serve loss (implicit) | ✅ no S2 | Explicit event taxonomy |
| Auto end switch | ❌ event only | `applySwitchEnds` at threshold |
| Freeze | ❌ | EXCLUDED (USAP 2026) |
| Game completion | Shared `checkGameComplete` | Same + enforce lock |
| Singles rally | `applySinglesRallyEvent` | Keep, test |
| `sideSwitchAt` / per-team threshold | Hardcoded total=11 | USAP 21.B (6/8/11) |
| Rally scoreboard UI | Missing | Hide side-out line |
| TT provision mapping | Gap | `scoringSystem` → `scoringFormat` |

**Tách khỏi side-out:**
- `rallyScoringEngine.js` (replace prototype)
- Rally position resolver (new — not `switchPartnersOnTeam` blindly)
- Rally serve rotation (populate `serveRotationEngine` or strategy method)

---

## 4. Anti-pattern cần tránh

```
// KHÔNG làm:
if (scoringSystem === "RALLY") { ... }  // trong receiverResolver, switchEnds, persistence, UI hooks
```

**Chỉ** branch tại:
1. `ScoringStrategy` selection (one place)
2. UI presentation selectors (scoreboard line, server badge)
3. Provision / init config mapping

---

## 5. Hai module `rallyScoringEngine` — phân biệt

| Path | Vai trò | Classification |
|------|---------|----------------|
| `referee-v5/engines/rallyScoringEngine.js` | Live rally-by-rally | **RALLY STRATEGY** (replace) |
| `team-tournament/engines/rallyScoringEngine.js` | End-game validation | **TT domain** — không merge vào V5 engine |

---

## 6. Ma trận tóm tắt

| Layer | SHARED | SIDE_OUT | RALLY |
|-------|:------:|:--------:|:-----:|
| matchStateEngine (orchestration) | ✅ | | |
| applyRallyWin router | | | → strategy pick |
| sideOutScoringEngine | | ✅ | |
| rallyScoringEngine | | | ✅ |
| receiverResolver | ✅ | | |
| courtPositionEngine (swap ends) | ✅ | | |
| courtPositionEngine (partner flip) | | ✅ | ⚠️ today wrongly shared |
| checkGameComplete | ✅ | | |
| Persistence / Edge / Realtime | ✅ | | |
| Scoreboard sideOutLine | | ✅ | |
| TT rallyScoringEngine validation | | | TT only |

**Code changes:** DOCUMENTATION ONLY
