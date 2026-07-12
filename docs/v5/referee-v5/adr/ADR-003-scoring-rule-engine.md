# ADR-003: Scoring Rule Engine

**Status:** Proposed (V5-A)  
**Date:** 2026-07-12

## Context

Pickleball supports side-out (traditional) and rally scoring with different point, serve, and side-switch rules. Team MLP uses rally with freeze/side-switch milestones. Hard-coding one rule breaks other formats.

## Decision

Pluggable **rule sets** selected by `scoring_format` on match:

| Rule set ID | Use case |
|-------------|----------|
| `side_out_doubles_v1` | Traditional doubles |
| `side_out_singles_v1` | Traditional singles |
| `rally_doubles_v1` | MLP / rally team |
| `rally_singles_v1` | Rally singles |

Each rule set exports:

```javascript
applyRallyWon(state, winningTeamId) → { stateDelta, events[] }
checkGameComplete(state) → boolean
checkMatchComplete(state) → boolean
getSideSwitchTriggers() → config
```

Side-out and rally **must not share** rotation logic.

## Consequences

- Reuse validation ideas from `rallyScoringEngine.js` for rally **end-game** only.
- New `sideOutDoubles.js` required — **NOT IMPLEMENTED** today.
- BTC configures format per match/discipline.

## Alternatives rejected

- **Single engine with if/else:** rejected — unmaintainable and error-prone.
