# Referee V5-B — Receiver & Diagonal Mapping

## Three coordinate systems

| Layer | Values | Role |
|-------|--------|------|
| Logical service side | `RIGHT_SERVICE_COURT`, `LEFT_SERVICE_COURT` | Pickleball rules (server/receiver) |
| Physical court end | `NEAR_END`, `FAR_END` | Referee physical view |
| Screen (derived) | `SCREEN_*` quadrants | UI display only |

Conversion: `logicalPositionToScreenPosition({ courtEnd, logicalServiceSide, viewMode })`.

## Receiver rule (doubles)

`resolveReceivingPlayer(state)`:

1. Find serving player
2. Opponent team at opposite `courtEnd`
3. Opponent player with **same** `logicalServiceSide` as server
4. Never use array index or CSS position

Example setup (Team A NEAR, Team B FAR):

| Server | Logical side | Receiver |
|--------|--------------|----------|
| A | NEAR RIGHT | D (FAR RIGHT) |
| A (after point) | NEAR LEFT | C (FAR LEFT) |
| D | FAR RIGHT | A (NEAR RIGHT) |
| C | FAR LEFT | B (NEAR LEFT) |

## Receiver rule (singles)

Receiver = sole opponent player (cross-court direction still derived from server position).

## Serve direction (derived, not stored)

`resolveServeDirection(state)` → one of:

```text
NEAR_RIGHT_TO_FAR_LEFT
NEAR_LEFT_TO_FAR_RIGHT
FAR_RIGHT_TO_NEAR_LEFT
FAR_LEFT_TO_NEAR_RIGHT
```

Computed from server `courtEnd` + `logicalServiceSide`. Screen diagonal naming matches referee physical view (FAR logical RIGHT → `SCREEN_TOP_LEFT`).

## Diagonal screen mapping (REFEREE_PHYSICAL_VIEW)

| Server position | Screen server quadrant | Receiver screen quadrant |
|-----------------|------------------------|--------------------------|
| NEAR + RIGHT | BOTTOM_RIGHT | TOP_LEFT |
| NEAR + LEFT | BOTTOM_LEFT | TOP_RIGHT |
| FAR + RIGHT | TOP_LEFT | BOTTOM_RIGHT |
| FAR + LEFT | TOP_RIGHT | BOTTOM_LEFT |

## Switch ends

After `ENDS_SWITCHED`, `resolveServeDirection()` returns inverted arrow; server and receiver **identities** unchanged.

## Validation

`validateServeSnapshot()` rejects:

- Same team server/receiver
- Same court end
- Doubles: mismatched logical service sides
- Player not in match
