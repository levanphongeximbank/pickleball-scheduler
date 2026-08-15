# CompetitionRefereeAdapterContract v1

- Contract ID: `competition.referee.adapter.v1` (LOCKED)
- Version: `1.0.0`
- Host: `src/features/competition-engine/integration/referee/`

## Adapter is

Translator + policy provider for a competition mode.

## Adapter is not

Referee identity, authorization, assignment persistence, lifecycle transitions, scoring calculation, score persistence, official result acceptance, match event authority, result revision authority.

Forbidden methods (fail-closed if present):

`assignReferee`, `persistAssignment`, `authorizeReferee`, `resolveRefereeIdentity`, `applyMatchTransition`, `completeMatch`, `recordPoint`, `calculateScore`, `persistScore`, `acceptResult`, `correctResult`, `persistResult`, `appendMatchEvent`, `persistEvent`, `reviseResult`

## Required methods

| Method | Returns |
|---|---|
| `getCompetitionContext(request)` | tenant, competition, mode, venue/club |
| `getMatchContext(request)` | match identity, schedule, court, parent/child |
| `getParticipants(request)` | two sides, lineup lock flag |
| `getScoringRules(request)` | CORE-16 `createScoringFormat` payload |
| `getLifecyclePolicy(request)` | assignment required; standings require CORE-17 accepted |
| `getCapabilities(request)` | flags; `owns*Authority` must be false |
| `validatePreStart(request)` | `{ ok, blockers[] }` fail-closed |
| `resolveResultPropagation(request)` | `propagateOnlyIfAccepted: true` always |

Request minimum: `{ tenantId, competitionId, matchId? }`. Missing tenant/competition → `MALFORMED_CONTEXT`.

## Mode adapters (not in this workstream)

- `DailyPlayRefereeAdapter` ← DAILY_PLAY
- `InternalTournamentRefereeAdapter` ← INTERNAL
- `OfficialTournamentRefereeAdapter` ← OFFICIAL
- `TeamTournamentRefereeAdapter` ← TEAM

Reference adapter `createReferenceRefereeAdapter` is TEST/CERTIFICATION only.
