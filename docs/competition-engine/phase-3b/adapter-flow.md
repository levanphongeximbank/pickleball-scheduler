# Adapter Flow — Phase 3B

## Interface

```text
ParticipantAdapter {
  id: string
  sourceType: string
  supports(source, context?): boolean
  map(source, context): CompetitionParticipant
}
```

## LegacyParticipantAdapter

- Source type: `LEGACY_PLAYER`
- Supports legacy player-like objects (`id` / `playerId`, optional guest markers)
- Rejects entry-like objects (`entryRole` + `participantIds`)
- Map via `mapLegacyPlayerToCompetitionParticipant`
- **Does not mutate** source
- **No** business orchestration beyond mapping

## Rules

```text
Each format adapter: MAP ONLY
No Canonical adapter in 3B
No Production legacy runtime rewrite
```
