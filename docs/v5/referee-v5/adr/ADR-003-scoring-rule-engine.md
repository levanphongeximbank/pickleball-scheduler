# ADR-003: Scoring Rule Engine

**Status:** Accepted (Rally R1-C, Owner 2026-07-13)  
**Date:** 2026-07-12  
**Rally spec:** `docs/v5/referee-v5/rally/V5-R1C_RALLY_STRATEGY_DESIGN.md`

## Context

Pickleball supports side-out (traditional) and rally scoring with different point, serve, and side-switch rules. Team MLP uses rally with freeze/side-switch milestones. Hard-coding one rule breaks other formats.

## Decision

Pluggable **rule sets** selected by `scoring_format` on match:

| Rule set ID | Use case |
|-------------|----------|
| `side_out_doubles_v1` | Traditional doubles |
| `side_out_singles_v1` | Traditional singles |
| `rally_usap_2026_provisional_doubles_v1` | USAP 2026 Rally doubles (R2 first) |
| `rally_singles_v1` | Rally singles (deferred) |
| `dreambreaker_singles_v1` | DreamBreaker (separate phase — not rally variant) |

Each rule set exports:

```javascript
applyRallyWon(state, winningTeamId) → { stateDelta, events[] }
checkGameComplete(state) → boolean
checkMatchComplete(state) → boolean
getSideSwitchTriggers() → config
```

Side-out and rally **must not share** rotation logic.

## Consequences

- **Do not** use `rallyScoringEngine.js` prototype as canonical — R2 delivers `Usap2026ProvisionalRallyDoublesStrategy`.
- Side-out: wrap existing `sideOutScoringEngine` — no behavior change in R2.
- Registry resolves format; **no silent fallback** Rally → Side-Out.
- First rally profile: 11 points, win by 2, doubles, `freezeRule=NONE` (see `V5-R1_OWNER_DECISIONS.md`).
- Rally ADRs: `docs/v5/referee-v5/rally/adr/ADR-004` … `ADR-006` (format immutability, scope, migration deferred).

## Alternatives rejected

- **Single engine with if/else:** rejected — unmaintainable and error-prone.
