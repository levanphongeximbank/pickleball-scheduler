# 05 — Mapping Interfaces

Mapping interfaces are contracts + shadow fixtures only. **Not wired** into Team Tournament / Daily / Individual runtime.

Each interface exposes:

```text
sourceType
sourceVersion
targetSchemaVersion
map
validateSource
validateTarget
diagnostics
```

| Mapper | Source → Target |
|--------|-----------------|
| `legacyPlayerToParticipantMapper` | Legacy player → CompetitionParticipant |
| `legacyEntryToEntryMapper` | Legacy entry → CompetitionEntry |
| `legacyTeamToTeamMapper` | Legacy team → CompetitionTeam |
| `legacyRosterToRosterMapper` | Legacy roster/playerIds → CompetitionRoster |
| `legacyLineupToLineupMapper` | Legacy lineup → CompetitionLineup |
| `legacyClassificationMapper` | Legacy event/group → Division **or** Category |

Hidden/public lineup policy remains Format-owned and is not hard-coded in Core mappers.
