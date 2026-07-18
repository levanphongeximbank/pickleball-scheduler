# 02 — Team Tournament Mapping

**Module:** `src/features/team-tournament/adapters/competition-core/`

| Legacy | Canonical | Mapper |
|--------|-----------|--------|
| Team player | `CompetitionParticipant` | `mapTeamPlayerToParticipant` |
| `normalizeTeam` | `CompetitionTeam` | `mapTeamToCompetitionTeam` |
| `playerIds` + lock meta | `CompetitionRoster` / `CompetitionRosterMember` | `mapTeamRosterToCompetitionRoster` |
| `normalizeLineup` + revisions | `CompetitionLineup` / `CompetitionLineupRevision` | `mapTeamLineupToCompetitionLineup` |
| Team registration | `CompetitionRegistration` (+ Entry if not waitlisted) | `mapTeamRegistration` |
| Bundle | team + roster (+ lineup) | `mapTeamTournamentBundle` |

## Preserved

- Captain (`captainPlayerId` → `captainRef`)
- Gender/category attrs (snapshot + extensions)
- Rating snapshot fields
- Membership / roster lock (`ROSTER_LOCKED`)
- Lineup revisions (not collapsed — OD-06)
- Hidden lineup: Format-owned via `extensions.payload.hiddenLineupPolicyRef`
- Substitution as `amendments[]` (OD-05)
- Source IDs

## Format-owned (not Core policy)

MLP composition, captain submission rules, hidden visibility, dreambreaker, team tie, forfeit — remain in Team Tournament engines / extensions only.
