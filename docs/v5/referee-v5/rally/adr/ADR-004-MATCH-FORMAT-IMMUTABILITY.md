# ADR-R-004: Match Format Immutability

**Status:** Accepted (Owner 2026-07-13)  
**Project:** REFEREE V5-R  
**Date:** 2026-07-13

## Context

Scoring format (`scoringSystem`, `scoringVariant`, `pointsToWin`, `winBy`, …) must not change mid-match. Team Tournament provisions format at sub-match creation; Referee V5 executes it. Changing format after `START_MATCH` would break replay, official results, and standings integrity.

## Decision

1. **Format is immutable** from first persisted state through finalize.
2. Fields locked at provision / `initializeMatchState`:
   - `scoringSystem`
   - `scoringVariant`
   - `pointsToWin`, `winBy`, `maximumScore` (if any)
   - `freezeRule`, `serverNumberRule`
   - `matchType` (DOUBLES for first rally profile)
   - `bestOf` (match-level)
3. **No client or RPC** may patch these fields after `status !== 'not_started'`.
4. **Replay** uses initial state format only — never per-event format override.
5. **Team Tournament:** discipline format copied at provision; bridge snapshot records format at provision time.

## Consequences

- Validation rejects `scoringSystem` change on live state.
- `buildRuleConfig` reads state only — no runtime format injection from commands.
- TT provision mapping must be correct **before** first rally (P0 from R1-B).

## Alternatives rejected

- **Per-game format change:** rejected — out of scope.
- **Silent default when format missing on new match:** rejected — explicit error required.
