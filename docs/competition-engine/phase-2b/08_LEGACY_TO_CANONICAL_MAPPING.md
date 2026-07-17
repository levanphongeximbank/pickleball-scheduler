# 08 — Legacy to Canonical Mapping

**Phase:** 2B.1  
**Runtime change:** None in this phase

---

## Format mapping matrix

| Format | Current model | Canonical target | Adapter needed? | Runtime change (2B.1) |
|--------|---------------|------------------|-----------------|------------------------|
| Daily Play | `player.id` + `checkedInPlayerIds` + court side player id arrays | `CompetitionParticipant` (session) + `MatchSide` player refs; **no Entry** | Yes (thin) | Chưa |
| Team Tournament V6 | `normalizeTeam` / roster `playerIds` / `normalizeLineup` | `CompetitionTeam` + `CompetitionRoster` + `CompetitionLineup` | Yes | Chưa |
| Individual | `normalizeEntry` + registration/eligibility engines | `CompetitionParticipant` + `CompetitionEntry` + `CompetitionRegistration` + `EligibilityDecision` | Yes | Chưa |
| Internal | Same entry model; often `ACTIVE` BTC entries | Same as Individual; Registration may be short-circuited | Yes (shared) | Chưa |
| Official | Same entry model; Open/AI Balance synthesizes entries | Same + Format extension for open pairing | Yes (shared + open preset) | Chưa |

---

## Symbol-level mapping

| Legacy symbol | Canonical | Notes |
|---------------|-----------|-------|
| `normalizePlayer` | Profile attrs + `ParticipantReference(kind=player_profile)` | Not CompetitionParticipant alone |
| `athletes.id` | `ParticipantReference(kind=athlete)` | Preferred when present |
| `profiles.id` | `platformUserId` link | Never competition entry id |
| `normalizeEntry` | `CompetitionEntry` (+ embedded Registration fields) | Split Registration in adapter |
| `ENTRY_STATUS` | Competition participant/entry status enum | Map legacy `active` |
| `EngineParticipant` | SeedIdentity subject + display metrics | Require subjectKind |
| `entryToParticipant` | Adapter: Entry → SeedIdentity(entry) | Keep until Core seed wired |
| `normalizeTeam` | `CompetitionTeam` | |
| `team.playerIds` | `CompetitionRosterMember[]` | |
| `normalizeLineup` | `CompetitionLineup` | |
| `LINEUP_STATUS` | Lineup status (Core-compatible subset) | Extended statuses Format |
| `EVENT_TYPE` | `CompetitionCategory.code` | |
| Individual `group` | `CompetitionDivision` | |
| TT team group | `CompetitionDivision` | |
| `checkPlayerEligibility` (TT/Individual) | Emit `EligibilityDecision` | |
| `RulePlayerSnapshot` | Input snapshot for eligibility/constraints | Not a Participant |
| `buildCanonicalSetupSnapshot` | Roster/Team lock artifact | Keep TT-owned builder initially |
| `team_tournament_lineup_entries` | Lineup slots | **Not** CompetitionEntry |
| Referee roster | Out of scope | Separate domain |

---

## Adapter inventory (proposed for 2B.2+)

| Adapter | Responsibility |
|---------|----------------|
| `individualEntryAdapter` | Entry ↔ CompetitionEntry/Registration |
| `dailyParticipantAdapter` | Check-in set ↔ Participant refs |
| `teamTournamentRosterAdapter` | Team blob/SQL ↔ Team/Roster |
| `teamTournamentLineupAdapter` | Lineup blob/SQL ↔ CompetitionLineup |
| `athleteReferenceAdapter` | Alias hydration → ParticipantReference |
| `engineParticipantAdapter` | Entry/Team/Player → SeedIdentity |

No adapter is wired in Phase 2B.1.

---

## Coverage checklist

| Area | Covered? |
|------|----------|
| Daily | ✅ |
| Team V6 | ✅ |
| Individual | ✅ |
| Internal | ✅ (via Individual entry) |
| Official | ✅ (via Individual entry + open note) |
| Competition-core seed handles | ✅ (adapter only) |
| Platform auth/athlete | ✅ |
| Referee participants | Explicitly out of competition participant canonical path |

**Legacy mapping coverage:** Complete for existing Production formats at design level.
