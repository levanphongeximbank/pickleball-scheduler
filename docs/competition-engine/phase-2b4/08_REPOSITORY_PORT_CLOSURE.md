# 08 — Repository Port Closure

Ports verified via public method lists + `matchesRepositoryPortShape`:

- ParticipantRepositoryPort
- EntryRepositoryPort
- RegistrationRepositoryPort
- TeamRepositoryPort
- RosterRepositoryPort
- LineupRepositoryPort
- DivisionRepositoryPort
- CategoryRepositoryPort

In-memory fake (tests only): `tests/fixtures/competition-core-2b4/inMemoryPorts.js`

Confirmed:

- No Supabase / SQL / table / HTTP / localStorage in port module
- Canonical DTOs save/load
- Roster/Lineup `saveRevision` revision-aware
- No format-specific policy in ports

**Persistence:** NOT IMPLEMENTED for Production.
