# 05 — Team, Roster, and Lineup Model

**Phase:** 2B.1

---

## Hard semantic split

| Term | Definition | Example (TT V6) |
|------|------------|-----------------|
| **Team** | Competing unit | `normalizeTeam` → `team.id` |
| **Roster** | Valid people who may represent the Team | `team.playerIds` (+ cloud members) |
| **Lineup** | People selected for one matchup/tie | `normalizeLineup` keyed `matchupId::teamId` |

| Anti-pattern | Why wrong |
|--------------|-----------|
| Calling Daily `teamAPlayerIds` a Team entity | Ephemeral court side |
| Calling Entry “team” because UI says “Đội” | Doubles pair Entry |
| Calling referee roster a competition Roster | Different domain |
| Treating lineup SQL `*_lineup_entries` as CompetitionEntry | Slot rows, not registration |

---

## Current TT V6 shapes (Production)

### Team

```text
id, name, color, logoUrl,
playerIds[], captainPlayerId, deputyPlayerIds[],
absentPlayerIds[], lockedPlayerIds[],
seed, avgLevel, topPlayerRating, totalRating
```

### Lineup

```text
matchupId, teamId, status,
selections: { [disciplineId]: playerIds[] },
submittedAt, lockedAt, publishedAt,
overriddenAt, overriddenBy, overrideReason,
previousLineupVersion, source, auditNote
```

Statuses: `not_submitted` | `draft` | `submitted` | `locked` | `published` | `overridden` (+ extended withdrawn/expired in state machine).

### Discipline “category”

`DISCIPLINE_CATEGORY`: singles | doubles | mixed — Format taxonomy for sub-matches, not Individual `EVENT_TYPE`.

---

## Canonical mapping

| Current | Canonical |
|---------|-----------|
| `normalizeTeam` | `CompetitionTeam` + embedded roster ids until Roster entity materializes |
| `playerIds[]` | `CompetitionRoster.members[]` |
| captain/deputies | Team role refs (Format extension or Team fields) |
| `normalizeLineup` | `CompetitionLineup` |
| `selections[disciplineId]` | `slots[]` with `disciplineOrSideKey` |
| Setup snapshot | Versioned roster/team freeze artifact |

---

## Locking (OD-04 / OD-05 / OD-06 OWNER APPROVED)

| Event | Roster | Lineup |
|-------|--------|--------|
| Team setup draft | Mutable | N/A |
| `ROSTER_LOCKED` (before Competition/Stage `IN_PROGRESS`) | Locked — SSOT is lifecycle event, not UI | N/A |
| Matchup scheduled | — | Draft allowed |
| Captain submit / change | — | New immutable revision |
| Deadline / BTC lock | — | LOCKED revision |
| Publish to opponent/public | — | PUBLISHED |
| BTC override | Substitution workflow only (default NOT ALLOWED after start) | OVERRIDDEN + new revision |
| Competition IN_PROGRESS | Default no roster sub; Format exception needs full audit (OD-05) | Per-match lineup rules |

**Approved:** `ROSTER_LOCKED` before `IN_PROGRESS`; substitutions after start default NOT ALLOWED with audited Format exception; lineup full version chain (minimum fields in `11_`).

---

## Core vs Format for team stack

| Concern | Owner |
|---------|-------|
| Team/Roster/Lineup structure & status enums | Core |
| Roster membership ⊆ Participant refs | Core validation |
| MLP composition, genderRequirement, playerCount | Format (TT) |
| Hidden lineup visibility | Format (TT) |
| Captain submission UX & deadlines | Format + Operations |
| Dreambreaker order | Format (TT) |
| Tie / forfeit | Format (TT) |

---

## Daily Play note

Daily must **not** invent `CompetitionTeam` for court sides. Optional future:

```text
MatchSide { sideKey: "A"|"B", playerRefs: ParticipantReference[] }
```

Owned by match lifecycle Core, not Team domain.
