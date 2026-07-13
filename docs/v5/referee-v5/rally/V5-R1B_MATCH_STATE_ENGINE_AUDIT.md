# REFEREE V5-R1B — Match State Engine Audit

**Phase:** R1-B  
**Date:** 2026-07-13  
**Scope:** Read-only audit of Referee V5 match state / scoring engines and tests.

---

## 1. Tổng quan kiến trúc hiện tại

`matchStateEngine.js` là **điểm vào duy nhất** cho mọi sự kiện trận đấu. Phân nhánh scoring xảy ra trong `applyRallyWin()` — không có registry rule-set riêng (ADR-003 chưa triển khai).

```
TEAM_A/B_WON_RALLY
  → applyMatchEvent
    → applyRallyWin
      → SINGLES: applySinglesScoringEvent (string "rally" vs side-out)
      → DOUBLES + scoringFormat === "rally": rallyScoringEngine
      → DOUBLES else: sideOutScoringEngine
```

**File engine chính:**

| File | Vai trò |
|------|---------|
| `engines/matchStateEngine.js` | Event switchboard, routing scoring |
| `engines/initializeMatchState.js` | Khởi tạo + START_MATCH |
| `engines/sideOutScoringEngine.js` | Doubles side-out |
| `engines/rallyScoringEngine.js` | Doubles rally (prototype) |
| `engines/singlesScoringEngine.js` | Singles side-out + rally |
| `engines/receiverResolver.js` | Người đỡ + recompute serve context |
| `engines/courtPositionEngine.js` | Vị trí logical / đổi sân / đổi partner |
| `engines/switchEndsEngine.js` | SWITCH_ENDS |
| `engines/undoEngine.js` | Undo |
| `engines/stateReplayEngine.js` | Replay từ event history |
| `engines/matchCommandDispatcher.js` | UI/command entry + history |
| `engines/serveRotationEngine.js` | **Chỉ re-export** — không có logic rotation |

---

## 2. Bảng function audit

| File | Function | Vai trò | Side-Out | Shared | Cần tách |
|------|----------|---------|:--------:|:------:|:--------:|
| `initializeMatchState.js` | `initializeMatchState` | Validate config, build state, `scoringFormat` default SIDE_OUT | N | Y | N |
| `initializeMatchState.js` | `startMatchFromInitialized` | NOT_STARTED → IN_PROGRESS | N | Y | N |
| `matchStateEngine.js` | `applyMatchEvent` | Xử lý mọi MATCH_EVENT_TYPE | N | Y | N |
| `matchStateEngine.js` | `applyRallyWin` | Router singles/doubles × side-out/rally | N | Y | **Y** |
| `matchStateEngine.js` | `buildRuleConfig` | Merge pointsToWin, winBy, sideSwitchAt | N | Y | Y |
| `matchStateEngine.js` | `assertValidServeSnapshot` | Post-rally invariant | N | Y | N |
| `sideOutScoringEngine.js` | `applySideOutScoringEvent` | Doubles side-out rally result | **Y** | N | N |
| `sideOutScoringEngine.js` | `activateServer2` | Server 1 → Server 2 | **Y** | N | N |
| `sideOutScoringEngine.js` | `performSideOut` | Side-out không điểm | **Y** | N | N |
| `sideOutScoringEngine.js` | `checkGameComplete` | Game end (pointsToWin + winBy) | N | Y | N |
| `rallyScoringEngine.js` | `applyRallyScoringEvent` | Doubles rally prototype | N | N | **Y** |
| `singlesScoringEngine.js` | `applySinglesSideOutEvent` | Singles side-out | **Y** | N | N |
| `singlesScoringEngine.js` | `applySinglesRallyEvent` | Singles rally | N | N | **Y** |
| `singlesScoringEngine.js` | `alignServerToScoreSide` | Chẵn/lẻ → ô giao | N | Y | Y (rally doubles) |
| `receiverResolver.js` | `resolveReceivingPlayer` | Diagonal receiver | N | Y | N |
| `receiverResolver.js` | `recomputeServeContext` | Cập nhật receivingPlayerId | N | Y | N |
| `courtPositionEngine.js` | `switchPartnersOnTeam` | Flip logical sides | N | Y | Y |
| `courtPositionEngine.js` | `swapTeamCourtEnds` | Đổi courtEnd | N | Y | N |
| `switchEndsEngine.js` | `applySwitchEnds` | SWITCH_ENDS event | N | Y | N |
| `undoEngine.js` | `undoLastEvent` | Replay-minus-one | N | Y | N |
| `stateReplayEngine.js` | `rebuildMatchState` | Full replay | N | Y | N |
| `matchCommandDispatcher.js` | `dispatchMatchCommand` | UI entry + history | N | Y | N |
| `domain/matchValidation.js` | `validateInitializeConfig` | Init validation, MLP reject | N | Y | N |
| `domain/matchValidation.js` | `validateServeSnapshot` | Diagonal / same-team guard | N | Y | N |
| `domain/matchState.js` | `createInitialMatchStateSkeleton` | State template | N | Y | N |

---

## 3. Chi tiết theo nhóm nghiệp vụ

### Khởi tạo / START_MATCH
- `initializeMatchState`: set `scoringFormat`, `pointsToWin` (default 11), `serverNumber` (doubles=1, singles=null).
- `startMatchFromInitialized`: chỉ đổi status — không đổi luật.

### RALLY_WON / cộng điểm
- Command: `TEAM_A_WON_RALLY` / `TEAM_B_WON_RALLY` (dùng cho **cả** side-out và rally).
- Side-out: chỉ +1 khi đội giao thắng.
- Rally prototype: **luôn +1** cho bên thắng.

### Server 1 / Server 2 / side-out
- **Chỉ** `sideOutScoringEngine.js`: `activateServer2`, `performSideOut`.
- Rally prototype: không có server 2, nhưng vẫn set `serverNumber = 1` khi chuyển giao — **sai semantics USAP rally**.

### Server / receiver selection
- Shared: `receiverResolver.js` — diagonal doubles, sole opponent singles.
- Side-out: server chọn theo preferred side sau side-out.
- Rally prototype: chọn player RIGHT khi nhận giao.

### Vị trí / logical side / physical court
- `courtPositionEngine.js`: logical → screen mapping (shared).
- Side-out: partner switch sau điểm khi đội giao thắng.
- Rally prototype: reuse `switchPartnersOnTeam` — **không theo điểm chẵn/lẻ**.

### Switch ends
- Manual: `SWITCH_ENDS` → `applySwitchEnds` (đổi courtEnd, giữ server/receiver).
- Rally prototype: milestone `ENDS_SWITCHED` tại tổng điểm = `sideSwitchAt` — **không gọi** `applySwitchEnds`.

### Game / match completion
- `checkGameComplete`: shared.
- `GAME_COMPLETED`: domain event only — **không** đổi status, không advance `currentGameNumber`.
- `MATCH_COMPLETED`: chỉ qua `DECLARE_FORFEIT` hoặc finalize path.

### Undo / replay
- Format-agnostic: replay qua `applyMatchEvent` → engine chọn theo `state.scoringFormat`.
- **Rủi ro:** nếu `scoringFormat` sai/missing → replay side-out cho trận rally.

---

## 4. `rallyScoringEngine.js` — trạng thái thực tế

**Không phải stub** — ~68 dòng, chạy được, nhưng **không khớp** USAP 2026 (R1-A):

| Hành vi | Có? |
|---------|-----|
| Mỗi rally +1 | ✅ |
| Chuyển giao khi đội nhận thắng | ✅ |
| Partner switch khi đội giao thắng | ✅ (simplified) |
| Server 1/2 | ❌ (đúng) nhưng vẫn set serverNumber=1 |
| Vị trí theo điểm chẵn/lẻ | ❌ |
| Đổi sân tự động | ❌ (chỉ emit event) |
| Freeze | ❌ |
| Test coverage | ❌ (0 test rally doubles) |

---

## 5. Nguy cơ làm hỏng Side-Out

| Rủi ro | Cơ chế |
|--------|--------|
| Sửa `checkGameComplete` / `receiverResolver` cho rally | Ảnh hưởng side-out nếu không tách strategy |
| Thêm `if (rally)` rải rác trong `matchStateEngine` | Regression side-out, khó test |
| Đổi `TEAM_*_WON_RALLY` semantics | Phá replay trận side-out cũ |
| Đổi `serverNumber` validation | Side-out doubles cần 1/2 |
| Sửa `switchPartnersOnTeam` | Cả side-out và rally prototype dùng chung |
| Default `scoringFormat` → rally | Trận mới side-out bị sai luật |

---

## 6. Test coverage engine

| File | Tests | Scoring format |
|------|-------|----------------|
| `referee-v5-engine.test.js` | 36 | **100% side-out** |
| `referee-v5-command.test.js` | 7 | **100% side-out** (+ MLP reject) |
| `testHelpers.js` | — | Chỉ `buildDoublesSideOutConfig` |

**Không có** `buildDoublesRallyConfig`.

---

## 7. Kết luận R1-B (engine)

| Mục | Kết quả |
|-----|---------|
| Side-out engine | Hoàn chỉnh, có test |
| Rally engine | Prototype tách file, chưa spec-compliant |
| Điểm tách | `applyRallyWin` — cần thay bằng ScoringStrategy |
| File sửa phase sau | `matchStateEngine.js`, `rallyScoringEngine.js`, `scoringFormats.js`, `buildRuleConfig`, validation |

**Code changes:** DOCUMENTATION ONLY
