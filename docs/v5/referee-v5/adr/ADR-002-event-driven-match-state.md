# ADR-002: Event-Driven Match State

**Status:** Proposed (V5-A)  
**Date:** 2026-07-12

## Context

Undo, audit, multi-device sync, and dispute resolution require knowing *what happened*, not only final scores.

## Decision

Clients submit **events** (intents). Server applies events through `matchStateEngine` and persists:

```text
match_events (append-only)
  → match_live_states (snapshot)
```

Undo creates `EVENT_REVERTED` referencing `reverted_event_id`; never DELETE.

## Event types (minimum)

`MATCH_STARTED`, `RALLY_WON`, `POINT_AWARDED`, `PLAYERS_SWITCHED`, `SECOND_SERVER_ACTIVATED`, `SIDE_OUT`, `SERVE_CHANGED`, `ENDS_SWITCHED`, `TIMEOUT_*`, `INCIDENT_RECORDED`, `EVENT_REVERTED`, `GAME_COMPLETED`, `MATCH_COMPLETED`, `RESULT_CONFIRMED`.

## Consequences

- State at version N is reproducible from events 1..N.
- Idempotency keyed by `(match_id, client_mutation_id)`.
- Viewers subscribe to snapshot version, not raw client payloads.

## Alternatives rejected

- **Direct score UPDATE from client:** current model — insufficient for positions.
