# 06 — Repository Ports

Ports only — **no** Supabase, SQL, HTTP, or browser-storage adapters.

| Port | Required methods (shape helpers) |
|------|----------------------------------|
| ParticipantRepositoryPort | getById, listByCompetition, save, findByExternalReference |
| EntryRepositoryPort | getById, listByCompetition, save, findActiveDuplicate |
| RegistrationRepositoryPort | getById, listByCompetition, save |
| TeamRepositoryPort | getById, listByCompetition, save |
| RosterRepositoryPort | getById, listByCompetition, save, saveRevision |
| LineupRepositoryPort | getById, listByCompetition, save, saveRevision |
| DivisionRepositoryPort | getById, listByCompetition, save |
| CategoryRepositoryPort | getById, listByCompetition, save |

`matchesRepositoryPortShape(port, methods)` checks structural compliance.  
`createInMemoryParticipantPorts()` is a **test fake only**, not Production persistence.
