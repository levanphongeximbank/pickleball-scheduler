# Canonical Team / Roster Model — Phase 3D

## CompetitionTeam (Runtime always populates)

| Field | Notes |
|-------|-------|
| `id` | Legacy stable team id (`stableTeamId`) |
| `competitionId` | Required |
| `name` | Required (not part of identity) |
| `status` | Canonical `COMPETITION_TEAM_STATUS` |
| `identityKey` | `competitionId::TEAM::stableTeamId` |
| `captainRef` | Optional `ParticipantReference` |
| `deputyRefs` | `ParticipantReference[]` |
| `seed` | Optional number |
| `extensions` / `audit` | Format payload + audit metadata |

## CompetitionRoster (Runtime always populates)

| Field | Notes |
|-------|-------|
| `id` | Deterministic `roster:{teamId}` |
| `competitionId` | Required |
| `teamId` | Required |
| `members` | `CompetitionRosterMember[]` |
| `status` | Canonical roster status (`ROSTER_LOCKED` when locked) |
| `identityKey` | `competitionId::ROSTER::teamId` |
| `lockedAt` / `lockReason` | Optional lock metadata |
| `amendments` | Always `[]` in Phase 3D (no substitution workflow) |
| `extensions` / `audit` | Format payload + audit metadata |

## CompetitionRosterMember

| Field | Notes |
|-------|-------|
| `id` | Deterministic `rm:{teamId}:{kind}:{id}` |
| `rosterId` | Parent roster id |
| `person` | `ParticipantReference` |
| `status` | ACTIVE / ABSENT / … |
| `role` | e.g. `captain` / `player` |
| member identity | `competitionId::ROSTER_MEMBER::teamId::kind:id` (in extensions payload) |

## Not in identity

Display name, color, logo, ratings, UI labels.

## Not in Phase 3D model ownership

`CompetitionLineup*` (Phase 3E), Registration entities (Phase 3C), Match / Schedule entities.
