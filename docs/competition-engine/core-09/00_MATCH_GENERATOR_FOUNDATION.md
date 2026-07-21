# CORE-09 — Match Generator Foundation

**Status:** Phase 1B implemented (capability-local, dormant)  
**Module:** `src/features/competition-core/match-generation/`  
**Production impact:** NONE

## Locked terminology

| Term | Meaning |
|------|---------|
| **CORE-09** | Match Generator — logical match-plan generation |
| **Not CORE-09** | Historical CC-09 Scheduling (date/time/court/resource) |
| **CORE-08** | Draw & Grouping (draw / draw-runtime substrates) |
| **Not CORE-08** | Historical CC-08 Standings |

Do **not** place CORE-09 implementation under `src/features/competition-core/scheduling/`.

## Phase 1B delivered

1. Domain contracts (`MatchGenerationRequest`, `MatchGenerationContext`, `LogicalMatch`, `MatchPlan`, `MatchDependency`, `ParticipantSlot`, `MatchGenerationResult`, `MatchGenerationIssue`)
2. Ports: `DrawResultPort`, `MatchGenerationRulePort` (read-only + fail-closed / fixed doubles)
3. Determinism policy + fingerprint helpers
4. Validation invariants (structured issue codes)
5. Ownership + migration documentation
6. Contract-level unit tests

## Explicit non-goals (this phase)

- Round-robin / knockout / Swiss executors
- Production runtime wiring
- Feature flags / UI / persistence / SQL / Supabase / deployment
- Changes to production tournament, Daily Play, Team Tournament, or scheduling engines

## Public surface

Capability-local: `src/features/competition-core/match-generation/index.js`  
Root `competition-core/index.js` and `unit-test-files.json` remain Integrator-owned (not modified in Phase 1B).

## Docs index

| Doc | Purpose |
|-----|---------|
| `01_OWNERSHIP_BOUNDARY.md` | Owns / does-not-own |
| `02_DOMAIN_INVARIANTS.md` | Invariant catalogue |
| `03_DETERMINISM_POLICY.md` | Determinism rules |
| `04_PORTS.md` | Draw + Rule ports |
| `05_MIGRATION_AND_COMPATIBILITY_MAP.md` | Future migration map |
| `06_PHASE_1B_DOMAIN_CONTRACTS.md` | Contract delivery note |
| `07_CONTRACT_DEFAULTS_AND_IMMUTABILITY.md` | Fail-closed enums, LMK grammar, freeze semantics |
