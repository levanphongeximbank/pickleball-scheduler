# REFEREE V5-R1B — Final Verdict

**Phase:** REFEREE V5-R1B — Current Engine and Code Audit  
**Date:** 2026-07-13  
**Project:** REFEREE V5-R (Rally Scoring)

---

## REFEREE V5-R1B: COMPLETE

### Repository
- **Name:** `pickleball-scheduler-referee-v5-rally`
- **Branch:** `feature/referee-v5-rally-scoring`
- **HEAD SHA:** `00317e95058b5e195c3b89623cfe98925fffecad`
- **Working tree:** Untracked docs only (`docs/v5/referee-v5/rally/`)

---

### Current engine

**Main engine files:**
- `src/features/referee-v5/engines/matchStateEngine.js` — event switchboard
- `src/features/referee-v5/engines/sideOutScoringEngine.js` — doubles side-out (production-tested)
- `src/features/referee-v5/engines/rallyScoringEngine.js` — doubles rally **prototype**
- `src/features/referee-v5/engines/singlesScoringEngine.js` — singles side-out + rally
- `src/features/referee-v5/engines/receiverResolver.js` — shared receiver
- `src/features/referee-v5/engines/courtPositionEngine.js` — positions / switch ends
- `src/features/referee-v5/engines/switchEndsEngine.js`, `undoEngine.js`, `stateReplayEngine.js`

**Side-Out specific logic:**
- Server 1 → Server 2 (`activateServer2`)
- Side-out without point (`performSideOut`)
- Point only when serving team wins
- `serverNumber` 1/2 semantics
- `formatSideOutScoreLine` UI

**Shared logic:**
- Event persistence, idempotency, atomic commit, replay hash
- Receiver diagonal (given correct positions)
- Manual switch ends, undo/replay framework
- Realtime version notification + full reload
- Finalize → official result → TT outbox

---

### Court Visualizer

| | |
|--|--|
| **Reusable** | Court layout, arrow, action panel, remote shell, connection status |
| **Conditional** | Scoreboard side-out line, server 1/2 badge, timeline labels, format label |
| **Rally-specific work required** | Hide side-out chrome, rally fixtures, presentation hints |

---

### Persistence

| | |
|--|--|
| **Event compatibility** | ✅ Same commands (`TEAM_*_WON_RALLY`) for both formats |
| **State schema impact** | Extend JSON (`scoringFormat` exists); optional `ruleSetId` — no DB migration required |
| **Migration required** | **NO** (TT provision **mapping fix** needed — logic not schema) |

**Replay:** Engine selected via `state.scoringFormat` — **risk** if field missing/wrong (P0-04).

---

### Edge

| | |
|--|--|
| **Engine selection point** | `matchStateEngine.applyRallyWin` (future: `ScoringStrategyRegistry`) |
| **Backend validation impact** | Minimal; need rally replay/finalize tests |

**Feature flags:** Client-only — Edge always runs full stack.

---

### Realtime

| | |
|--|--|
| **Reusable as-is** | **YES** |

Version-only notification; full state reload via `get-state`. No contract change for Rally.

---

### Team Tournament

| | |
|--|--|
| **Existing format field** | TT: `scoringSystem`; V5: `scoringFormat` — **mapping gap P0-06** |
| **Bridge impact** | Provision must map discipline → V5 state correctly |
| **Result impact** | Minimal — final scores only |
| **Standings impact** | None |

Legacy portal locked when V5 bridge active. DreamBreaker out of TT-5 V5 scope.

---

### Tests

| | Count |
|--|------:|
| **Existing Side-Out regression (engine+command)** | **43** |
| **Shared infrastructure tests** | **~126** (169 total V5 − 43 SO-specific scoring) |
| **New Rally tests required** | **≥25** (currently **0** V5 rally) |

**Must always PASS:** All 43 side-out engine/command tests + shared persistence/d1/e1/tt5.

---

### Architecture recommendation

| | |
|--|--|
| **Pattern** | **ScoringStrategy + Registry** (ADR-003) |
| **Shared core** | Lifecycle, persistence, replay, receiver (given positions), switch ends manual, realtime, finalize |
| **Side-Out strategy** | `sideOutScoringEngine`, singles side-out, server 1/2, side-out UI line |
| **Rally strategy** | Replace `rallyScoringEngine` prototype per USAP 2026; new position logic; fix side-switch |

**Anti-pattern:** `if (rally)` scattered outside strategy selection.

---

### Findings

**P0:**
- TT provision `scoringSystem` → `scoringFormat` mapping gap
- Replay wrong engine if `scoringFormat` missing
- Side-out regression risk on shared modules
- Rally prototype wrong positions / side-switch / serverNumber

**P1:**
- Zero rally test coverage
- UI side-out biased (server 1/2, sideOutLine)
- No formal `ruleSetId`
- `GAME_COMPLETED` doesn't lock match

**P2:**
- UI wording, timeline labels, animations

---

### R1-C readiness

**YES**

Đủ audit để bắt đầu **R1-C** (architecture / rules spec pack) sau owner review.  
**R1-C chưa bắt đầu trong lượt này.**

Owner decisions từ R1-A vẫn **PENDING** (default 21, win-by-1, doubles-first).

---

### Code changes

**DOCUMENTATION ONLY**

### SQL

**NOT APPLIED**

### Deployment

**NOT PERFORMED**

### Production

**UNTOUCHED**

---

### Next phase

**R1-C only after owner review** — formalize ScoringStrategy spec, rule pack `rally_usap_2026`, provision mapping contract, test matrix.

---

## Tài liệu R1-B đã tạo

| File |
|------|
| `V5-R1B_MATCH_STATE_ENGINE_AUDIT.md` |
| `V5-R1B_COURT_VISUALIZER_AUDIT.md` |
| `V5-R1B_PERSISTENCE_EVENT_AUDIT.md` |
| `V5-R1B_EDGE_REALTIME_AUDIT.md` |
| `V5-R1B_TEAM_TOURNAMENT_INTEGRATION_AUDIT.md` |
| `V5-R1B_TEST_INVENTORY.md` |
| `V5-R1B_SHARED_SIDEOUT_RALLY_CLASSIFICATION.md` |
| `V5-R1B_ENGINE_EXTRACTION_PROPOSAL.md` |
| `V5-R1B_RISK_REGISTER.md` |
| `V5-R1B_FINAL_VERDICT.md` |

---

## Tóm tắt cho chủ dự án

Hệ thống Referee V5 **đã chạy tốt cho Side-Out** (169 test, 43 test luật side-out). Rally **đã có file engine riêng** nhưng còn là bản thử nghiệm, **chưa đúng luật USAP 2026**, và **không có test**.

Điểm nguy hiểm nhất: khi Team Tournament cấu hình Rally, có thể **vẫn tạo trận V5 ở chế độ Side-Out** do lệch tên field (`scoringSystem` vs `scoringFormat`).

Đề xuất: tách luật thành **hai chiến lược riêng** (Side-Out / Rally), không trộn `if` rải rác. Realtime **dùng lại được**. R1-C sẽ viết đặc tả kiến trúc trước khi code Rally thật.

**End of REFEREE V5-R1B**
