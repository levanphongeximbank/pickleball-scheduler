# ADR-004: Player Position and Court Orientation

**Status:** Proposed (V5-A)  
**Date:** 2026-07-12

## Context

Referee V5 must show where each athlete stands and who serves/receives. Device rotation must not corrupt data.

## Decision

### Storage enums (language-neutral)

```text
court_end:   NEAR_END | FAR_END
court_side:  LEFT_SERVICE_COURT | RIGHT_SERVICE_COURT
```

### View mode

Default referee UI: **`REFEREE_PHYSICAL_VIEW`**

- `NEAR_END` = end closest to referee device (bottom of screen).
- `FAR_END` = opposite end (top).
- On `ENDS_SWITCHED`, swap team `court_end` assignments in **state**, not CSS-only.

Optional `TEAM_FIXED_VIEW` for broadcast (V5-C+ research).

### Participant record

Each participant in snapshot:

```json
{
  "playerId": "...",
  "teamId": "...",
  "courtEnd": "NEAR_END",
  "courtSide": "RIGHT_SERVICE_COURT",
  "isServer": true,
  "isReceiver": false
}
```

Receiver (người đỡ bóng) computed by **serveRotationEngine** using diagonal cross-court mapping:

```text
RIGHT_SERVICE_COURT → opposite end, RIGHT_SERVICE_COURT
LEFT_SERVICE_COURT  → opposite end, LEFT_SERVICE_COURT
```

Never from screen coordinates. UI: **ĐANG GIAO** + **ĐỠ BÓNG** + diagonal arrow. Full spec: **V5-B §3–13**.

## Consequences

- Vietnamese UI labels (`Ô trái`, `Ô phải`) are display mapping only.
- Optional display alias `Ô 1`/`Ô 2` via `displayCourtSideLabel()` — never stored in DB.

## Alternatives rejected

- **Screen-relative slots (top-left, etc.):** rejected — breaks on rotate/end switch.
