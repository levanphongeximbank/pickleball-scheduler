# ADR-R-006: Migration Decision Deferred

**Status:** Accepted (Owner 2026-07-13)  
**Project:** REFEREE V5-R  
**Date:** 2026-07-13

## Context

R1-B found that rally may be supportable via JSON state extension (`scoringFormat`, optional `scoringVariant`) without immediate DB migration. Owner requires explicit decision after real data audit — not a permanent "no migration" conclusion.

## Decision

1. **R1-C / R2 planning:** document **migration decision deferred**.
2. **No SQL apply** until implementation/integration phase after:
   - Production/staging schema diff audit
   - Field naming alignment (`scoringSystem` vs `scoringFormat`)
   - TT provision mapping verification
3. **Minimum state fields** (logical contract, storage TBD):

```text
scoringSystem      — RALLY | SIDE_OUT
scoringVariant     — USAP_2026_PROVISIONAL_RALLY | SIDE_OUT_DOUBLES_V1 | ...
pointsToWin        — number
winBy              — number
freezeRule         — NONE | ...
serverNumberRule   — NONE | SIDE_OUT_1_2
ruleSetId          — optional canonical registry key
```

4. **Legacy matches** without `scoringSystem`: replay under explicit legacy profile — not rally.

## Consequences

- R2 may ship with JSON-only state extension if audit confirms.
- Separate migration ADR/SQL in integration phase if columns or constraints required.
- P0-06 (TT provision mapping) resolved in integration — may be SQL or application layer.

## Alternatives rejected

- **"No migration ever":** rejected — deferred only.
- **Apply migration in R1-C:** rejected — no SQL in research phases.
