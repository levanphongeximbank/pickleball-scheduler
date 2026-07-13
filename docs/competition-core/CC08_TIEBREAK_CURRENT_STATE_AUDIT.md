# CC-08 — Tie-break Current State Audit

## Legacy group (`rankingEngine.js`)
- Order: matchPoints → scoreDiff → pointsFor → won → name
- No explicit head-to-head or mini-table
- FORFEIT awards win/forfeit points without score diff

## Tournament Engine 4.0
- Adds head-to-head criterion for pairs only
- Warns on unresolved ties near qualification border
- `manual` criterion stops chain → name sort (placeholder)

## Team tournament (`teamStandingsEngine.js`)
- Configurable `tiebreakOrder`; default wins → subMatchDiff → pointsScored → manual
- Optional headToHead in code but not default
- No multi-way mini-table

## CC-08 canonical default pipeline
1. TOTAL_POINTS
2. HEAD_TO_HEAD (2 entries)
3. MINI_TABLE (3+ entries)
4. GAME/POINT difference
5. SCORE_FOR
6. FEWER_FORFEITS
7. ORIGINAL_SEED
8. DRAW_LOT (deterministic)

Legacy mappings preserve legacy tie-break keys via `legacyKey` on TieBreakRule.
