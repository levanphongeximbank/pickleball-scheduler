# Referee V5-C — UI Component Specification

## Layout (mobile)

```text
1. Match header
2. Scoreboard
3. Court visualizer
4. Serve context + event timeline
5. Action panel
```

## Components

| Component | Responsibility |
|-----------|----------------|
| `RefereeMatchHeader` | Tournament meta, game, format, status |
| `RefereeScoreboard` | Large scores, side-out line `A – B – server`, serving team highlight |
| `CourtVisualizer` | NEAR bottom / FAR top, net, kitchen, 4/2 player slots |
| `PlayerPositionCard` | Name, team, logical side, **ĐANG GIAO** / **ĐỠ BÓNG** badges |
| `ServeDirectionArrow` | SVG diagonal arrow from selector geometry only |
| `ServeContextPanel` | Text fallback: server, receiver, server #, direction |
| `RefereeActionPanel` | Rally buttons (not +1), undo, switch ends, pause, timeout |
| `MatchEventTimeline` | Last 10 events incl. domain + `EVENT_REVERTED` |
| `RefereeConfirmationDialog` | Switch ends, reset prototype |

## Data flow

```text
User action → useRefereeMatchController.dispatch()
           → dispatchMatchCommand()
           → applyMatchEvent() / undoEngine
           → nextState
           → useCourtVisualizerState() selectors
           → presentational components
```

UI must **not** compute serve/receiver/score transitions locally.

## Labels (Vietnamese)

- Server: `ĐANG GIAO` + optional `S1`/`S2`
- Receiver: `ĐỠ BÓNG`
- Rally: `ĐỘI A THẮNG RALLY` / `ĐỘI B THẮNG RALLY`

## Animation

- Partner switch: 150–300ms CSS (`rv5-switch` keyframe)
- `prefers-reduced-motion`: animations disabled
