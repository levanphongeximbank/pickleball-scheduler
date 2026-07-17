# 04 — DTO Versioning

All Phase 2B.2 DTOs use `schemaVersion: "1"` and a `dtoType` discriminator.

| DTO | Factory |
|-----|---------|
| ParticipantDTO | `createParticipantDTOv1` |
| EntryDTO | `createEntryDTOv1` |
| RegistrationDTO | `createRegistrationDTOv1` |
| TeamDTO | `createTeamDTOv1` |
| RosterDTO | `createRosterDTOv1` |
| LineupDTO | `createLineupDTOv1` |
| DivisionDTO | `createDivisionDTOv1` |
| CategoryDTO | `createCategoryDTOv1` |

Guarantees:

- JSON-safe (`JSON.stringify` / `JSON.parse`)
- No React elements, functions, clients, or circular refs
- No Supabase serialization
