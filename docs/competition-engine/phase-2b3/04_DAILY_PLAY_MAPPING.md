# 04 — Daily Play Mapping

**Module:** `src/features/daily-play/adapters/competition-core/`  
(Daily engine remains under `src/tournament/engines/dailyPlayEngine.js`.)

| Legacy | Canonical | Mapper |
|--------|-----------|--------|
| Player / walk-in / external | `CompetitionParticipant` | `mapDailyPlayerToParticipant` |
| `checkedInPlayerIds` session | Participant list; **no Entry** | `mapDailySessionParticipants` |
| Match `teamA/BPlayerIds` | Temporary pair representation | `mapDailyTemporaryPair` |

## Explicit exclusions

- Queue / rotation policy stays Format-owned (`queuePolicyRef` extension only).
- Temporary pairs are **not** `CompetitionTeam` / `CompetitionEntry`.
- No Daily cutover of matchmaking or court engines.
