# CORE-06 Phase 1C — Canonical Domain Foundation

**Status:** Implemented (capability-local, dormant)  
**Prerequisite:** Phase 1B `READY_FOR_PHASE_1C`  
**Production impact:** NONE

## Delivered

- Domain service: `createLineupDomainService` (`lineups/services/lineupDomainService.js`)
- Revision helpers, invariant validators, extended transition matrix (`LOCKED → VOIDED`)
- Contracts: `LineupVisibilityGrant`, `MissingLineupResolution`
- Ports: persistence (expectedVersion), authorization, visibility, clock, random, roster lookup, audit, idempotency
- Additive lineup scope fields on `createCompetitionLineup` / revision factory
- Unit tests: `tests/competition-core-lineup-core06-phase1c.test.js`

## Non-goals (confirmed)

- No Production wiring / TT writer replacement / dual-write
- No SQL / RPC / UI / feature-flag ON
- No root `competition-core/index.js` Integrator edits in this phase
