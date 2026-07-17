# 03 — Individual Tournament Mapping

**Module:** `src/features/individual-tournament/adapters/competition-core/`

| Legacy | Canonical | Mapper |
|--------|-----------|--------|
| Player | `CompetitionParticipant` | `mapIndividualPlayerToParticipant` |
| `normalizeEntry` | `CompetitionRegistration` + optional `CompetitionEntry` | `mapIndividualEntry` |
| group / event | `CompetitionDivision` / `CompetitionCategory` | `mapIndividualClassification` |

## Handled cases

| Case | Behavior |
|------|----------|
| Singles | `entryRole: singles`, one memberRef |
| Doubles | `entryRole: doubles`, two memberRefs |
| Partner invite | Token in Format extensions — not Core policy |
| Guest | `PARTICIPANT_REFERENCE_KIND.GUEST` (OD-01) |
| External | `EXTERNAL` kind |
| Multiple divisions | Separate Entries — never auto-merged (OD-02) |
| Waitlisted | Registration `WAITLISTED`, **no** Entry (OD-10) |
| Missing competitionId | Diagnostic `MISSING_COMPETITION_ID` (OD-03) |
| Seed lock | `SeedLockedRatingSnapshot` when requested (OD-09) |

Division (`groupId`) and Category (`eventId`) stay separate fields (OD-07).
