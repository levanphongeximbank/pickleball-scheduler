# Referee V5-B — Court Position Specification

**Status:** Design (V5-A) — **Supplement:** diagonal serve & receiver (2026-07-12)  
**Related ADR:** [ADR-004](./adr/ADR-004-player-position-and-court-orientation.md)

---

## 1. Coordinate system

### 1.1 Court ends

| Enum | Meaning | Referee UI (REFEREE_PHYSICAL_VIEW) |
|------|---------|-------------------------------------|
| `NEAR_END` | End closest to referee / device | Bottom half of screen |
| `FAR_END` | Opposite end | Top half of screen |

Ends are **relative to referee physical position**, not compass or venue map.

### 1.2 Service courts (doubles)

| Enum | Meaning | Vietnamese UI |
|------|---------|---------------|
| `LEFT_SERVICE_COURT` | Left half of court from server's facing direction | Ô trái |
| `RIGHT_SERVICE_COURT` | Right half | Ô phải |

**Database never stores** `Ô 1` / `Ô 2` without mapping table.

Optional display mapping (config per tournament):

```javascript
const DISPLAY_SIDE_LABELS = {
  LEFT_SERVICE_COURT: "Ô trái",   // or "Ô 1" if owner approves
  RIGHT_SERVICE_COURT: "Ô phải",  // or "Ô 2"
};
```

---

## 2. Participant state schema

```typescript
interface MatchParticipantPosition {
  playerId: string;
  teamId: string;
  courtEnd: "NEAR_END" | "FAR_END";
  courtSide: "LEFT_SERVICE_COURT" | "RIGHT_SERVICE_COURT";
  isServer: boolean;
  isReceiver: boolean;  // người đỡ bóng — engine-computed only
}
```

### Terminology (UI Vietnamese)

| English | Vietnamese UI label | Must NOT use alone |
|---------|---------------------|-------------------|
| Server | **ĐANG GIAO** | "Giao" without receiver context |
| Receiver | **ĐỠ BÓNG** | "Nhận" (ambiguous) |
| Service court | **Ô giao** / **Ô trái** / **Ô phải** | Screen-left/right |

### Example — State 1: A serves to D (diagonal)

Team 1: A, B — Team 2: C, D. A serves from `RIGHT_SERVICE_COURT` at `NEAR_END`:

```json
[
  { "playerId": "A", "teamId": "team-1", "courtEnd": "NEAR_END", "courtSide": "RIGHT_SERVICE_COURT", "isServer": true, "isReceiver": false },
  { "playerId": "B", "teamId": "team-1", "courtEnd": "NEAR_END", "courtSide": "LEFT_SERVICE_COURT", "isServer": false, "isReceiver": false },
  { "playerId": "C", "teamId": "team-2", "courtEnd": "FAR_END", "courtSide": "LEFT_SERVICE_COURT", "isServer": false, "isReceiver": false },
  { "playerId": "D", "teamId": "team-2", "courtEnd": "FAR_END", "courtSide": "RIGHT_SERVICE_COURT", "isServer": false, "isReceiver": true }
]
```

Derived serve context:

```json
{
  "servingPlayerId": "A",
  "receivingPlayerId": "D",
  "servingCourtSide": "RIGHT_SERVICE_COURT",
  "receivingCourtSide": "RIGHT_SERVICE_COURT",
  "servingCourtEnd": "NEAR_END",
  "receivingCourtEnd": "FAR_END",
  "serveDirection": "NEAR_RIGHT_TO_FAR_RIGHT"
}
```

### Example — State 2: Team A scores, A switches to LEFT, serves to C

After `POINT_AWARDED` + `PLAYERS_SWITCHED` (partners swap sides, receiver team holds):

```json
[
  { "playerId": "A", "teamId": "team-1", "courtEnd": "NEAR_END", "courtSide": "LEFT_SERVICE_COURT", "isServer": true, "isReceiver": false },
  { "playerId": "B", "teamId": "team-1", "courtEnd": "NEAR_END", "courtSide": "RIGHT_SERVICE_COURT", "isServer": false, "isReceiver": false },
  { "playerId": "C", "teamId": "team-2", "courtEnd": "FAR_END", "courtSide": "LEFT_SERVICE_COURT", "isServer": false, "isReceiver": true },
  { "playerId": "D", "teamId": "team-2", "courtEnd": "FAR_END", "courtSide": "RIGHT_SERVICE_COURT", "isServer": false, "isReceiver": false }
]
```

```json
{
  "servingPlayerId": "A",
  "receivingPlayerId": "C",
  "serveDirection": "NEAR_LEFT_TO_FAR_LEFT"
}
```

---

## 3. Mandatory pre-serve display contract

Before every serve, referee screen **must** show (no dialog required):

| Field | Source |
|-------|--------|
| Người giao bóng | `serving_player_id` |
| Người đỡ bóng | `receiving_player_id` |
| Ô giao bóng | `serving_court_side` → Ô trái/phải |
| Ô nhận hợp lệ | `receiving_court_side` at opponent end |
| Đường giao chéo sân | derived `serve_direction` |
| Quyền giao | `serving_team_id` |
| Server 1 / 2 | `server_number` |

**Forbidden:** marking server without computed receiver; straight-court or wrong-box arrow.

---

## 4. Diagonal cross-court serve rules (mandatory)

### 4.1 Logic mapping (not screen coordinates)

`LEFT` / `RIGHT` are defined **from each team's facing direction** toward the net, not from device screen edges.

```text
RIGHT_SERVICE_COURT  →  DIAGONALLY_OPPOSITE_RIGHT_SERVICE_COURT
LEFT_SERVICE_COURT   →  DIAGONALLY_OPPOSITE_LEFT_SERVICE_COURT
```

Algorithm:

```javascript
function resolveLegalReceivingSide(serverCourtSide) {
  // Same relative service side on opponent end = diagonal cross-court
  return serverCourtSide; // RIGHT→RIGHT, LEFT→LEFT across the net
}

function resolveReceiver(state) {
  const server = getParticipant(state, state.servingPlayerId);
  const opponentTeamId = opposingTeam(state.servingTeamId);
  const legalSide = resolveLegalReceivingSide(server.courtSide);
  const opponentEnd = opposingEnd(server.courtEnd, state);

  const candidates = state.participants.filter(
    (p) => p.teamId === opponentTeamId
      && p.courtEnd === opponentEnd
      && p.courtSide === legalSide
  );

  if (candidates.length !== 1) {
    return { ok: false, error: "INVALID_RECEIVER_MAPPING" };
  }

  return { ok: true, receivingPlayerId: candidates[0].playerId };
}
```

**Forbidden:** derive receiving box from `screenX/screenY` or CSS quadrant alone.

### 4.2 Serve direction (derived, optional cache)

Prefer computing from positions; optional denormalized enum for debugging:

```text
NEAR_RIGHT_TO_FAR_RIGHT
NEAR_LEFT_TO_FAR_LEFT
FAR_RIGHT_TO_NEAR_RIGHT
FAR_LEFT_TO_NEAR_LEFT
```

Formula:

```text
serve_direction = `${server.courtEnd}_${server.courtSide}_TO_${receiver.courtEnd}_${receiver.courtSide}`
```

---

## 5. Receiver (người đỡ bóng) determination

### 5.1 Definition

**Người đỡ bóng** = opposing-team athlete standing in the **legal diagonal receiving service court**.

### 5.2 Inputs (engine-only)

```text
positions of all four athletes
serving_player_id
serving_team_id
court_end per team
server_number
scoring_system (singles/doubles)
side-out vs rally rule set
ends_switched history
game start serve order
```

### 5.3 Manual selection

| Condition | Allowed |
|-----------|---------|
| Normal play | **No** — engine only |
| Override role + wrong lineup at start | **Yes** — reason + audit `RECEIVER_OVERRIDE` |

### 5.4 Recompute triggers

Receiver **must** be recomputed after:

- `POINT_AWARDED` + partner `PLAYERS_SWITCHED` (server changes service side)
- `SECOND_SERVER_ACTIVATED`
- `SIDE_OUT` / `SERVE_CHANGED`
- `ENDS_SWITCHED` (display/arrow only — **same player IDs**)
- `MATCH_STARTED` / initial serve selection

---

## 6. Server and receiver rules (legacy §3 expanded)

### 6.1 Receiver determination

Receiver **must** be computed by `serveRotationEngine` (see §4–5).

**Forbidden:** UI picking nearest opponent; straight-net arrow; same-team receiver.

### 6.2 Doubles diagonal serve (side-out)

Cross-court only. Arrow must:

- Start at server position
- Cross net
- End in receiver's service court (not NVZ label zone — visual hint only)
- **Not** end at same-side non-diagonal box

### 6.3 Singles

One athlete per end; receiver is the sole opponent at the diagonal service court side determined by even/odd serve-side rules (same `LEFT↔LEFT`, `RIGHT↔RIGHT` mapping across ends).

---

## 7. Rally won → position changes

### 4.1 Side-out doubles — serving team wins

```text
→ Award point to serving team (side-out score)
→ Serving team retains serve
→ Both players on serving team SWITCH court_side (left ↔ right)
→ Receiving team players HOLD position
→ Same server continues from new court_side
→ Recompute receiver (e.g. A RIGHT→D becomes A LEFT→C)
```

Example transition:

```text
Before: A=RIGHT (server), B=LEFT
After:  A=LEFT (server), B=RIGHT
```

Emit events: `POINT_AWARDED`, `PLAYERS_SWITCHED`, `SERVE_CHANGED` (if receiver changes).

### 4.2 Side-out doubles — receiving team wins

```text
→ No point to either side (side-out) OR per local rules — default: no point
→ server_number: 1 → 2 (same team) OR 2 → SIDE_OUT
→ On SIDE_OUT: serve passes to other team; determine correct server per rules
→ Positions unchanged unless rules require
```

Emit: `RALLY_WON`, optionally `SECOND_SERVER_ACTIVATED`, `SIDE_OUT`, `SERVE_CHANGED`.

---

## 8. ENDS_SWITCHED (đổi sân) — mandatory invariants

### 8.1 Must update on ENDS_SWITCHED

```text
court_end of both teams (swap)
display coordinates of all four athletes
serving_player_id (same person)
receiving_player_id (same person)
serve arrow direction (recomputed)
serving_court_side / receiving_court_side (unchanged relative to athlete)
serving_court_end / receiving_court_end (swapped with team ends)
```

### 8.2 Must NOT change on ENDS_SWITCHED

```text
scores (including side-out display)
serving_team_id
server_number
serve rotation order
serving_player_id identity
receiving_player_id identity
```

After end switch, **same athletes** remain server/receiver; only ends and arrow geometry change.

### 8.3 State mutation

When referee confirms **ĐỔI SÂN**:

```text
team_a_end ↔ team_b_end   (swap which end each team occupies)
FOR EACH participant:
  court_end ← team's new end
  court_side UNCHANGED (left stays left, right stays right)
serving_team_id UNCHANGED
serving_player_id UNCHANGED
server_number UNCHANGED
scores UNCHANGED
```

Emit: `ENDS_SWITCHED` with payload `{ reason: "manual" | "game_end" | "milestone", milestoneScore?: number }`.

### 8.4 UI behavior

- Teams swap vertical position on screen.
- Animation ≤ 300ms; must not block next rally tap.
- Arrow direction recomputed from new geometry.

### 8.5 Automatic end switch triggers

| Trigger | Config key |
|---------|------------|
| End of game | `switchEndsAtGameEnd: true` |
| At N points | `switchEndsAtScore: 6` (singles classic) |
| Rally milestone | `sideSwitchAt: 11` (MLP) |
| Manual only | `manualSwitchOnly: true` |

---

## 9. SIDE_OUT sequence (mandatory)

When serve passes to opponent (`SIDE_OUT`):

1. Determine new `serving_team_id`
2. Determine new `serving_player_id`
3. Determine `serving_court_side` / `serving_court_end`
4. Compute legal `receiving_player_id` on opposing team
5. Recompute diagonal `serve_direction`
6. Update UI labels **ĐANG GIAO** / **ĐỠ BÓNG**
7. Emit `SIDE_OUT`
8. Emit `SERVE_CHANGED`
9. Realtime sync to director + live score (V5-E)

---

## 10. Server validation (reject invalid state)

Server **must reject** snapshot or event result if:

| Rule | Error code |
|------|------------|
| Server and receiver same team | `RECEIVER_SAME_TEAM` |
| Receiver not in diagonal legal side | `RECEIVER_NOT_DIAGONAL` |
| Server not on serving team | `SERVER_WRONG_TEAM` |
| Two `isServer=true` | `DUPLICATE_SERVER` |
| Two `isReceiver=true` | `DUPLICATE_RECEIVER` |
| Unknown player IDs | `PLAYER_NOT_IN_MATCH` |
| Arrow/box mismatch vs engine | `SERVE_DIRECTION_INVALID` |
| Both teams same `court_end` after ENDS_SWITCHED | `ENDS_COLLISION` |
| Client `receiving_player_id` ≠ engine | `CLIENT_RECEIVER_REJECTED` |

Client may send only intents (`RALLY_WON`, `SWITCH_ENDS`, `UNDO_LAST_EVENT`). Server computes all serve/receive fields.

---

## 11. View modes

| Mode | Use | Default |
|------|-----|---------|
| `REFEREE_PHYSICAL_VIEW` | Referee on court | **Yes** |
| `TEAM_FIXED_VIEW` | Team A always bottom | No (broadcast research) |

---

## 12. Visualizer component contract

```typescript
interface CourtVisualizerProps {
  participants: MatchParticipantPosition[];
  viewMode: "REFEREE_PHYSICAL_VIEW";
  servingTeamId: string;
  serveDirection: { fromPlayerId: string; toPlayerId: string };
  teamLabels: { teamA: string; teamB: string };
  onAnimationComplete?: () => void;
}
```

```typescript
interface ServeDisplayContext {
  servingPlayerId: string;
  receivingPlayerId: string;
  servingTeamId: string;
  serverNumber: 1 | 2;
  servingCourtSide: "LEFT_SERVICE_COURT" | "RIGHT_SERVICE_COURT";
  receivingCourtSide: "LEFT_SERVICE_COURT" | "RIGHT_SERVICE_COURT";
  serveDirection: string; // derived
}

interface CourtVisualizerProps {
  participants: MatchParticipantPosition[];
  viewMode: "REFEREE_PHYSICAL_VIEW";
  serve: ServeDisplayContext;
  teamLabels: { teamA: string; teamB: string };
  onAnimationComplete?: () => void;
}
```

### Server (người giao)

- Ball icon at server
- Gold/amber border
- Label **ĐANG GIAO**
- Badge **Server 1** or **Server 2**
- Highlight current service court (Ô trái/phải)

### Receiver (người đỡ bóng)

- Distinct border color (e.g. cyan — **not** same as server)
- Label **ĐỠ BÓNG**
- Highlight receiving service court
- **No** ball icon on receiver

### Serve arrow (diagonal only)

- SVG line: server centroid → across net → receiver service court
- Must update on: partner switch, side-out, end switch, server 1→2
- **Forbidden:** horizontal same-side arrow; arrow to wrong box

No physics simulation required — direction clarity only.

---

## 13. UI acceptance criteria (referee glance test)

Referee must answer **without opening dialogs**:

1. Ai đang giao bóng?
2. Ai đang đỡ bóng?
3. Giao từ ô nào?
4. Bóng phải đi sang ô nào (chéo)?
5. Đội nào có quyền giao?
6. Server 1 hay 2?
7. Sau rally vừa rồi ai đổi vị trí?
8. Hai đội đang ở đầu sân nào?

---

## 14. Current state gap

| Item | Status |
|------|--------|
| Position in DB | **NOT IMPLEMENTED** |
| Position in UI | **NOT IMPLEMENTED** |
| Diagonal serve/receiver engine | **NOT IMPLEMENTED** (V5-B) |
| Pre-serve mandatory display | **NOT IMPLEMENTED** |

---

*Design specification — no code in production.*
