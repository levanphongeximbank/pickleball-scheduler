# Referee V5-D — UI Specification

**Target:** Mobile-first referee workspace  
**Feature flag:** `VITE_REFEREE_V5_ENABLED=false`  
**Route (proposed, not added in V5-A):** `/referee-v5/match/:matchId`

---

## 1. Design goals

1. One-hand operation outdoors.
2. Court state visually matches physical court.
3. Rally intent buttons, not blind +1.
4. Sub-300ms animations; no blocking modals per rally.
5. Clear sync/offline status.

---

## 2. Screen layout (mobile 360px+)

```text
┌─────────────────────────────────────┐
│ HEADER (match meta + sync)          │
├─────────────────────────────────────┤
│ SCOREBOARD (large)                  │
│   Team A  5                         │
│   Team B  3                         │
│   [5 – 3 – 1] side-out strip        │
├─────────────────────────────────────┤
│ COURT VISUALIZER (min 240px height) │
│   FAR END — Team 2                  │
│   [D]     NET     [C]  ← receiver  │
│   ───────────────                   │
│   [B]             [A] 🟡 serve →    │
│   NEAR END — Team 1                 │
├─────────────────────────────────────┤
│ PRIMARY ACTIONS (sticky bottom)     │
│ [ ĐỘI A THẮNG RALLY ] [ ĐỘI B ... ] │
├─────────────────────────────────────┤
│ SECONDARY (scroll / sheet)          │
│ Hoàn tác | Đổi sân | Tạm dừng | ... │
└─────────────────────────────────────┘
```

---

## 3. Header (§9.1)

| Field | Source |
|-------|--------|
| Tournament name | `match_live_states` / tournament meta |
| Event / discipline | tournament config |
| Round / stage | match meta |
| Match code | `match_id` short form |
| Court | assignment |
| Game X of Y | `game_number`, `best_of` |
| Scoring format | `scoring_system` label |
| Connection | navigator.onLine |
| Sync | queue depth / `version` lag |

Chip colors:

- Green: synced
- Amber: pending mutations
- Red: conflict / offline blocked

---

## 4. Scoreboard (§9.2)

### Rally scoring

```text
   ĐỘI A    15
   ĐỘI B    12
   Game 1/3
```

### Side-out scoring

```text
   ĐỘI A    5
   ĐỘI B    3
   Server: 1  (Đội A đang giao)
   Đọc tỷ số: 5 – 3 – 1
```

Tooltip/help: explain three-number format on first use.

---

## 5. Court visualizer (§9.3) — serve / receiver / diagonal arrow

Component: `CourtVisualizer.jsx` (proposed). Full rules: **V5-B §3–13**.

### 5.1 Pre-serve info strip (below scoreboard)

Always visible — no tap required:

```text
Người giao: A  |  Người đỡ: D  |  Quyền giao: Đội A  |  Server 1
Ô giao: Phải  →  Ô nhận: Chéo phải (đối diện)
```

### 5.2 ASCII reference — State 1 (A → D)

```text
┌──────────────────────────────────────────┐
│                 ĐỘI B                    │
│       C                      D            │
│                           ĐỠ BÓNG ◉       │
│                              ↗             │
├───────────────── LƯỚI ───────────────────┤
│                        ↗                 │
│       B              A 🟡                │
│                    ĐANG GIAO              │
│                 ĐỘI A                    │
└──────────────────────────────────────────┘
Tỷ số: 0 – 0 – 1
```

### 5.3 ASCII reference — State 2 (A scored, switched left → C)

```text
┌──────────────────────────────────────────┐
│                 ĐỘI B                    │
│       C                      D            │
│    ĐỠ BÓNG ◉                             │
│       ↖                                  │
├───────────────── LƯỚI ───────────────────┤
│             ↖                            │
│     A 🟡                    B             │
│   ĐANG GIAO                              │
│                 ĐỘI A                    │
└──────────────────────────────────────────┘
Tỷ số: 1 – 0 – 1
```

### 5.4 Visual elements

| Element | Spec |
|---------|------|
| Court | Green rectangle, white lines, net bar |
| Players | Avatar/initials min 48px |
| Server | Gold ring + 🟡 + **ĐANG GIAO** + Server 1/2 badge |
| Receiver | Cyan ring + **ĐỠ BÓNG** (≠ server color) |
| Ball | Icon at server only |
| Arrow | **Diagonal** SVG: server → net → receiver box |
| Service courts | "Ô trái" / "Ô phải" at each end |

**Forbidden:** straight-net arrow; "NHẬN" label; receiver same styling as server; arrow not updating after switch/end/side-out.

Animations:

| Event | Animation |
|-------|-----------|
| `PLAYERS_SWITCHED` | Partners slide horizontal 200ms; **arrow retargets** |
| `ENDS_SWITCHED` | Teams swap vertical 250ms; **arrow inverts**; IDs unchanged |
| `SIDE_OUT` | Server/receiver badges swap teams; arrow redraw |
| `POINT_AWARDED` | Score pulse 150ms |

**Forbidden:** CSS rotate court without `court_end` state update.

### 5.5 Mobile 360px

- Labels **ĐANG GIAO** / **ĐỠ BÓNG** min 11px, bold, contrast ≥ 4.5:1
- Arrow stroke ≥ 2px; visible over court background
- Info strip wraps to 2 lines before truncating names

### 5.6 UI acceptance (glance test)

Referee answers without dialogs: ai giao, ai đỡ, ô nào, hướng chéo, quyền giao, server 1/2, ai vừa đổi vị trí, đầu sân mỗi đội (V5-B §13).

---

## 6. Primary actions (§9.4)

| Button | Event | Size |
|--------|-------|------|
| ĐỘI A THẮNG RALLY | `RALLY_WON` team A | min-height 56px, full width stack on 360px |
| ĐỘI B THẮNG RALLY | `RALLY_WON` team B | same |

Disabled when:

- `status === locked`
- offline blocked mode
- submitting mutation

---

## 7. Secondary actions

| Button | Event | Confirm |
|--------|-------|---------|
| HOÀN TÁC | `EVENT_REVERTED` | No (single tap; optional 3s toast undo) |
| ĐỔI SÂN | `ENDS_SWITCHED` | **Yes** |
| TẠM DỪNG | `MATCH_PAUSED` | No |
| TIMEOUT | `TIMEOUT_STARTED` | Optional pick team |
| SỰ CỐ | `INCIDENT_RECORDED` | Form |
| BỎ CUỘC | `FORFEIT_DECLARED` | **Yes** + reason |
| KẾT THÚC GAME | `GAME_COMPLETED` manual | **Yes** (override) |
| XÁC NHẬN KẾT QUẢ | finalize RPC | **Yes** + score summary |

---

## 8. Confirmations (§9.5)

Dialog pattern (MUI): reuse `RefereeScoreboard` finalize dialog style.

Required fields on override/forfeit: `reason` text min 10 chars.

---

## 9. Accessibility

- `aria-live="polite"` on scoreboard region
- Server/receiver: `aria-label` not color-only
- Min contrast 4.5:1 for outdoor (high contrast theme flag — owner decision)

---

## 10. Coexistence with legacy UI

| Flag | User sees |
|------|-----------|
| `VITE_REFEREE_V5_ENABLED=false` | Existing `RefereeScoreboard` |
| `true` + assignment V5 | New UI; link from RefereeHub "Chấm V5 (beta)" |

Legacy routes **unchanged** in V5-A.

---

## 11. Current state

| Item | Status |
|------|--------|
| Court visualizer + diagonal arrow | **NOT IMPLEMENTED** |
| ĐANG GIAO / ĐỠ BÓNG labels | **NOT IMPLEMENTED** |
| Pre-serve info strip | **NOT IMPLEMENTED** |

---

*UI specification — no production UI deployed.*
