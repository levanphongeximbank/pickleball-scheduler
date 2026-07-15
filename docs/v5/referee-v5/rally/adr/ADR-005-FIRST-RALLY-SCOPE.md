# ADR-R-005: First Rally Scope

**Status:** Accepted (Owner 2026-07-13)  
**Project:** REFEREE V5-R  
**Date:** 2026-07-13

## Context

Multiple rally variants exist (USAP 2026, historical freeze, MLP DreamBreaker). Owner approved a narrow first delivery to reduce regression risk and align with R1-A research.

## Decision

### In scope — R2

| Item | Value |
|------|-------|
| Match type | **Doubles only** |
| Rule profile | `USAP_2026_PROVISIONAL_RALLY` |
| `scoringSystem` | `RALLY` |
| `pointsToWin` | **11** (default); architecture supports 15/21 later |
| `winBy` | **2** |
| `freezeRule` | **NONE** |
| `serverNumberRule` | **NONE** (no Server 1/2) |
| Match completion | Early end when `gamesWon >= ceil(bestOf/2)` |

### Out of scope — R2

- Singles rally
- DreamBreaker (separate format / future ADR)
- MLP rally doubles / freeze @20
- `scoringVariant` = MLP or historical freeze profiles
- UI format picker (config at provision/BTC only for R2)

### Replace, not extend

- Current `rallyScoringEngine.js` prototype is **not** the canonical implementation.
- R2 delivers new `Usap2026ProvisionalRallyDoublesStrategy` per R1-C design.

## Consequences

- `singlesScoringEngine` rally path untouched in R2.
- Tests: ≥25 new rally doubles tests; 43 side-out regression tests must PASS.
- DreamBreaker module deferred to future `DreamBreakerSinglesStrategy` or similar.

## Alternatives rejected

- **Singles + doubles in R2:** rejected by owner.
- **Keep prototype as official:** rejected by owner.
- **Default 21 points:** rejected — owner chose **11** with configurable architecture.
