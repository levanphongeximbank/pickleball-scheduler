# CC-08 — Mini-Table (Three or More)

Module: `miniTable.js`

- Builds sub-table from matches among tied entries only
- Recomputes statistics via `accumulateStandingsRows`
- Ranks subset using non-recursive tie-break rules
- Supports partial resolution with nested mini-table for remaining tied subset
- Max depth guard prevents infinite recursion

Trace: `StandingsDecisionTrace.miniTableCalculations`.
