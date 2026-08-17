# Referee Adapter B — Consolidated Mode Adoption 01 (Phase 2A)

## Scope

Phase 2A implements the four Competition Mode Referee Adapter B translators:

| Mode | Factory | Registry key |
|------|---------|--------------|
| Daily Play | `createDailyPlayRefereeAdapter` | `DAILY_PLAY` |
| Internal Tournament | `createInternalTournamentRefereeAdapter` | `INTERNAL` |
| Official / Open Tournament | `createOfficialTournamentRefereeAdapter` | `OFFICIAL` |
| Team Tournament | `createTeamTournamentRefereeAdapter` | `TEAM` |

Contract: `competition.referee.adapter.v1` / `1.0.0` (LOCKED — End A unchanged).

## Architecture (unchanged)

```
Competition Mode
  → Mode Referee Adapter B (translator / policy only)
  → competition.referee.adapter.v1
  → E2E-04 Referee Operations
  → CORE-13 / CORE-15 / CORE-16 / CORE-17
  → Canonical Durable Referee Runtime
```

## What Adapter B may do

- Read injected mode state (`modeState` / `getModeState`)
- Map competition / match / participants / scoring rules / lifecycle / capabilities
- Validate pre-start (fail closed)
- Describe CORE-17 accepted-only result propagation

## What Adapter B must not do

- Authenticate users
- Assign referees / persist assignments
- Advance score / finalize match
- Accept official results / append events / write revisions
- Call browser-exposed privileged RPC
- Create browser-storage or in-memory production fallbacks
- Cut over production (`usesAdapterB` remains false)

## Registry

```js
import {
  createCompetitionRefereeModeAdapterRegistry,
  createCompetitionRefereeModeAdapters,
} from "../src/features/competition-engine/index.js";

const registry = createCompetitionRefereeModeAdapterRegistry({
  dailyPlay: { modeState },
  internal: { modeState },
  official: { modeState },
  team: { modeState },
});
```

Unknown mode / version mismatch / malformed adapter → fail closed.

## Mode notes

### Daily Play

- Session/roster is **not** CORE-13 assignment authority.
- Pre-start requires `canonicalAssignmentAuthorityAvailable === true`.
- Daily Play score RPCs are not adopted as CORE-16 authority.
- No direct score mutation in Adapter B.

### Internal / Official

- Separate adapters even where legacy match shapes are shared.
- `/referee/:token` and `tournament_match_live` are legacy evidence only — never Adapter B authority.
- Official keeps explicit `registrationContext` / `eligibilityContext`.

### Team

- Parent matchup assignment SSOT
- Child override where defined
- DreamBreaker inherits parent; no duplicate DreamBreaker assignment
- Write policy projection: organizer `can_manage` OR assigned canonical uid
- Automatic/idempotent V5 ensure remains Team domain policy (described, not executed)
- DreamBreaker rotation remains Team domain authority

## Cutover status (Phase 2A end)

| Flag | Value |
|------|-------|
| `usesAdapterB` (production runtime) | `false` |
| `stagingBackendCertified` | `false` (unchanged) |
| `COMPETITION_REFEREE_ADAPTER_INTEGRATION.usesAdapterBProductionCutover` | `false` |
| `COMPETITION_REFEREE_ADAPTER_INTEGRATION.modeAdaptersImplemented` | `true` |

Phase 2B (Owner GO required): runtime cutover / certification.

## Tests

`tests/competition-engine-referee-adapter-b-mode-adoption-01.test.js`  
Side-loaded via `tests/competition-engine-e2e-04-player-referee-operations.test.js`.

## Source layout

```
src/features/competition-engine/integration/referee/adapters/
  DailyPlayRefereeAdapter.js
  InternalTournamentRefereeAdapter.js
  OfficialTournamentRefereeAdapter.js
  TeamTournamentRefereeAdapter.js
  index.js
  shared/
    matchStatusMapper.js
    modeContext.js
    scoringRulesMapper.js
    policyBuilders.js
    individualTournamentMapping.js
```
