# Referee V5-B — Serve Rotation Engine

## Doubles side-out

Implemented in `sideOutScoringEngine.js`.

### Serving team wins rally

1. +1 point
2. Both partners swap `logicalServiceSide`
3. Same `servingPlayerId`, same `serverNumber`
4. Recompute receiver

### Receiving team wins — server 1

1. No point
2. No position change
3. `serverNumber` → 2
4. `servingPlayerId` → partner
5. Recompute receiver

### Receiving team wins — server 2

1. No point
2. Side-out to opponent
3. `serverNumber` → 1 (configurable initial side via `sideOutInitialServerSide`)
4. New server = player on preferred logical side (default RIGHT)
5. Recompute receiver

## Singles

Implemented in `singlesScoringEngine.js` (separate from doubles rotation):

- No server 1/2
- Even score → serve from `RIGHT_SERVICE_COURT`
- Odd score → serve from `LEFT_SERVICE_COURT`
- Side-out transfers serve to opponent; align side to score

## Rally scoring

`rallyScoringEngine.js` — winning team scores; serve follows winner.  
**OWNER DECISION REQUIRED** for full MLP partner rotation between rallies.

## Switch ends

`switchEndsEngine.js` — `ENDS_SWITCHED`:

- Swap team `courtEnd` values only
- Preserve scores, server, receiver IDs, server number, logical sides

## Config constants

- `sideOutInitialServerSide` — first server side after side-out (default RIGHT)
- Not hard-coded without rule config path
