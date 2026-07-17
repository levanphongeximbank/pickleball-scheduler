# 01 — Implemented Contracts

Schema version for all Phase 2B.2 participant contracts: **`1`**.

| Contract | Factory | Notes |
|----------|---------|-------|
| ParticipantReference | `createParticipantReference` | Discriminated kinds |
| ParticipantSnapshot | `createParticipantSnapshot` | OD-08 |
| SeedLockedRatingSnapshot | `createSeedLockedRatingSnapshot` | OD-09 representation only |
| CompetitionParticipant | `createCompetitionParticipant` | Person + competition scope |
| CompetitionEntry | `createCompetitionEntry` | Requires `competitionId` |
| CompetitionRegistration | `createCompetitionRegistration` | Owns waitlist |
| EligibilityDecision | `createEligibilityDecision` | Append-only decision shape |
| CompetitionTeam | `createCompetitionTeam` | TT unit |
| CompetitionRoster | `createCompetitionRoster` | Lockable member set |
| CompetitionRosterMember | `createCompetitionRosterMember` | Person on roster |
| RosterSubstitutionReference | `createRosterSubstitutionReference` | OD-05 representation |
| CompetitionLineup | `createCompetitionLineup` | Current revision envelope |
| CompetitionLineupRevision | `createCompetitionLineupRevision` | Immutable revision |
| CompetitionLineupSlot | `createCompetitionLineupSlot` | Slot identity |
| CompetitionDivision | `createCompetitionDivision` | OD-07 |
| CompetitionCategory | `createCompetitionCategory` | OD-07 |

Each contract supports: schemaVersion, required/optional fields via factory defaults, status where applicable, audit metadata, and `FormatExtension` for format-owned opaque payload.
