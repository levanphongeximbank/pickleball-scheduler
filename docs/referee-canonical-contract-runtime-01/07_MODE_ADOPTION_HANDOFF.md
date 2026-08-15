# Mode adoption handoff (END B)

This workstream froze END A. Mode workstreams implement adapters only.

## Implement

1. `DailyPlayRefereeAdapter`
2. `InternalTournamentRefereeAdapter`
3. `OfficialTournamentRefereeAdapter`
4. `TeamTournamentRefereeAdapter`

Each must:

- `contractId = competition.referee.adapter.v1`
- `contractVersion = 1.0.0`
- `competitionMode` in `DAILY_PLAY | INTERNAL | OFFICIAL | TEAM`
- expose the eight required methods
- fail closed on unknown match / malformed / cross-tenant / missing scoring rules
- set `propagateOnlyIfAccepted: true`
- set `ownsScoringAuthority/ownsResultAuthority/ownsRefereeIdentity = false`
- pass `runCompetitionRefereeAdapterConformance`

Register via `createCompetitionRefereeAdapterRegistry({ adapters: [...] })`.

## Must not

- Own scoring, lifecycle, result acceptance, assignment persistence, referee identity
- Require `TEAM_MATCH_RESULT_MANAGE` for generic submit/correct
- Create `*_v2` persistence tables
- Change Team Tournament accepted PR #418 behavior except through the adapter translator
- Redesign `/referee` UI

## Team Tournament notes (locked)

- parent matchup assignment SSOT
- effective child referee = child override else parent
- Dreambreaker inherits parent; no second Dreambreaker assignment
- assigned canonical uid authority
- organizer management authority
- automatic/idempotent runtime ensure
- F5 persistence

Team adapter translates those rules into contract payloads. Do not rebuild a second engine.

## Next runtime step (not this workstream)

Inject a durable V5-table repository into `createCanonicalRefereePersistenceRuntime` and only then consider `wiredToProductionRuntime=true`.
