# CC-09 — Request Mapping

Source: `legacySchedulingMapping.js` → `mapLegacySchedulingPayloadToRequest`

## Preserved fields

| Legacy | Canonical |
|---|---|
| tournamentId, eventId | SchedulingRequest root |
| groups / group | participants + matches (GROUP_STAGE) |
| matchups / teams | participants + matches (TEAM_TOURNAMENT) |
| matches | SchedulingMatch[] |
| courts | SchedulingCourt[] (available, locked) |
| scheduleConfig | SchedulingConfiguration (timezone, durations, start/end) |
| manualOverrides | SchedulingOverride[] |
| randomFn, randomSeed | legacyExtensions / configuration.extensions |
| timezone | configuration.timezone |
| consumer | metadata.legacyConsumer + scope detection |

## Scope detection

- `team_tournament` — matchups or teams present
- `tournament_engine` — scheduleConfig or consumer flag
- default — `group_stage`

## Unmapped fields

Unknown top-level keys → warning `UNMAPPED_LEGACY_FIELD:<key>` (not silently dropped).

## Strategy resolution

| Scope | Strategy |
|---|---|
| team_tournament | TEAM_TOURNAMENT |
| tournament_engine | BALANCED |
| group_stage | GROUP_STAGE |
