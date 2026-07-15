# REFEREE V5-R1B — Court Visualizer Audit

**Phase:** R1-B  
**Date:** 2026-07-13  
**Scope:** UI components, hooks, selectors — read-only.

---

## 1. Luồng dữ liệu scoreboard

```
matchState (engine / DB state_payload)
  → useCourtVisualizerState(matchState, teamNames)
  → visualState { scoreA, scoreB, sideOutLine, serveContext, arrow, ... }
  → RefereeScoreboard / CourtVisualizer / ServeContextPanel
```

| Mode | Nguồn state |
|------|-------------|
| Prototype | `useRefereeMatchController` → in-memory sau `dispatchMatchCommand` |
| Remote | `useRefereeRemoteMatchController` → Edge `get-state` → `match_live_states.state_payload` |

Điểm số: copy trực tiếp `state.teams.teamA/B.score` — **không** tính lại từ events.

---

## 2. Server 1/2 hiển thị ở đâu

| Vị trí | Cách hiển thị | Điều kiện |
|--------|---------------|-----------|
| `PlayerPositionCard.jsx` | Badge `🎾 ĐANG GIAO S{n}` | `isServer` + `serverNumber` từ serveContext |
| `ServeContextPanel.jsx` | `Server: {serverNumber}` | Ẩn khi singles |
| `RefereeScoreboard.jsx` | `sideOutLine` = `"A – B – {serverNumber}"` | **Chỉ doubles** |

Nguồn: `buildServeContext` đọc `state.serverNumber` — không tính riêng cho UI.

---

## 3. Bảng component

| Component | Dùng chung | Cần điều kiện scoring | Cần tách riêng |
|-----------|:----------:|:---------------------:|:--------------:|
| `CourtVisualizer` | ✅ | ❌ | ❌ |
| `PlayerPositionCard` | ✅ | Server badge S{n} | Rally: semantics S1 misleading |
| `ServeDirectionArrow` | ✅ | ❌ | ❌ |
| `RefereeScoreboard` | ⚠️ | **Có** — sideOutLine doubles only | Rally: ẩn/thay side-out line |
| `ServeContextPanel` | ⚠️ | Ẩn S# singles | Rally: ẩn hoặc đổi label S# |
| `RefereeActionPanel` | ✅ | ❌ (luôn TEAM_*_WON_RALLY) | ❌ |
| `MatchEventTimeline` | ⚠️ | Labels SIDE_OUT, SECOND_SERVER | Rally labels |
| `RefereeMatchHeader` | ✅ | `formatLabel` đã branch rally | ❌ |
| `RefereeConnectionStatus` | ✅ | ❌ | ❌ |
| `RefereeV5Workspace` | ✅ | Fixture chỉ side-out | Rally fixture thiếu |
| `useCourtVisualizerState` | ⚠️ | formatLabel, sideOutLine | Rally visual rules |
| `useRefereeMatchController` | ✅ | Engine route nội bộ | ❌ |
| `useRefereeRemoteMatchController` | ✅ | Load state từ DB | Phụ thuộc provision |
| `scoreboardSelector` | ⚠️ | `formatSideOutScoreLine` side-out only | Rally subtitle |
| `serveContextSelector` | ✅ | ❌ | ❌ |
| `serveArrowSelector` | ✅ | ❌ | ❌ |
| `timelineSelector` | ⚠️ | Side-out domain labels | Rally events |

---

## 4. Chi tiết presentation

### Scoreboard
- `RefereeScoreboard`: highlight đội đang giao qua `servingTeamSide`.
- `sideOutLine`: **side-out specific** — format `"scoreA – scoreB – serverNumber"`.

### Serve arrow / direction
- `serveArrowSelector` + `serveContextSelector`: dựa trên courtEnd + logicalServiceSide.
- **Không** phụ thuộc scoring format — reusable.

### Player positions
- `useCourtVisualizerState` map players qua `logicalPositionToScreenPosition`.
- Shared cho side-out và rally (nếu engine giữ đúng logical sides).

### Switch ends
- UI không có animation riêng — state `courtEnd` đổi → arrow/positions cập nhật.
- Test UI #18–19, #29–30 cover switch ends (side-out fixtures).

### Timeline
- `timelineSelector`: map domain events → label tiếng Việt.
- `RALLY_WON` bị suppress; hiển thị `SIDE_OUT`, `SECOND_SERVER_ACTIVATED` (side-out bias).

### Remote / connection
- `RefereeConnectionStatus`: realtime state only.
- Reload full state qua Edge — không apply partial scoring logic.

---

## 5. Rally-specific work required (UI)

| Hạng mục | Công việc |
|----------|-----------|
| Scoreboard | Ẩn `sideOutLine` hoặc thay bằng rally hint (21, win-by-2) |
| Server badge | Rally USAP: không hiển thị S1/S2 semantics |
| Format label | Đã có `"Doubles / Basic rally"` |
| Prototype fixture | Thêm `doubles-rally` fixture |
| Timeline | Labels cho rally-only transitions (serve change without SIDE_OUT) |
| Format picker | Chưa có — engine-only |

---

## 6. Kết luận

| | |
|--|--|
| **Reusable** | Court layout, arrow, action buttons, remote sync shell |
| **Conditional** | Scoreboard side-out line, server number panel, timeline labels |
| **Rally work** | Display rules + fixtures + hide side-out-specific chrome |

**Không sửa UI trong R1-B.**

**Code changes:** DOCUMENTATION ONLY
