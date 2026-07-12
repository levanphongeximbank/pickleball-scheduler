# CC-08 — Tie-break Pipeline

Implemented in `tieBreakCompare.js`, `tieBreakSteps.js`, `miniTable.js`, `headToHead.js`, `drawLot.js`.

TieBreakRule: `id`, `type`, `priority`, `enabled`, `parameters`, `scope`, `version`, `explanationTemplate`, optional `legacyKey`.

Supported types: TOTAL_POINTS, HEAD_TO_HEAD, MINI_TABLE, SET/GAME/POINT_DIFFERENCE, SCORE_FOR, FEWER_FORFEITS, ORIGINAL_SEED, DRAW_LOT, CUSTOM.

Ranking flow:
1. Accumulate rows from matches
2. Pre-sort by primary criterion
3. Detect tied groups
4. Resolve each group via ordered rules
5. Apply manual overrides
6. Assign final ranks + qualification

Protection: mini-table recursion capped at depth 8; draw-lot uses deterministic hash (no Math.random).
