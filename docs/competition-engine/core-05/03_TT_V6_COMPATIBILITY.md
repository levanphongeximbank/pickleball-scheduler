# Core-05 — Team Tournament V6 Compatibility

## 1. Principle

TT V6 remains the **Production write system of record**.

Core-05 provides a **map-only** compatibility adapter under:

`src/features/competition-core/teams/adapters/ttV6TeamRosterCompatAdapter.js`

No TT engines, UI, RPC, or cloud repositories are modified or invoked for writes.

---

## 2. Mapping rules (Phase 1)

| TT field | Canonical mapping |
|----------|-------------------|
| `id`, `name` | Team id / name |
| `playerIds[]` | Roster members (`person` refs) |
| `captainPlayerId` | `captainRef` + member role `captain` |
| `deputyPlayerIds` | `deputyRefs` + format extensions |
| `withdrawn` / withdrawal | Team status `WITHDRAWN` when indicated |
| `color`, `logoUrl`, ratings | Format `extensions` only |
| `lockedPlayerIds` | Format extensions / member payload **only** — **never** `ROSTER_LOCKED` |
| `absentPlayerIds` | Member status `ABSENT` — **not** removal |
| Lineup `selections` | **Excluded** from roster membership |

Canonical roster lock is set only from explicit TT roster lock signals (`locked`, `rosterStatus = ROSTER_LOCKED`, or adapter context `rosterLocked`), never from `lockedPlayerIds` alone.

---

## 3. Adapter vs existing TT shadow mappers

Existing product adapter:

`src/features/team-tournament/adapters/competition-core/teamTournamentParticipantAdapters.js`

That mapper may optionally treat `lockedPlayerIds` as lock when `treatLockedPlayerIdsAsRosterLock === true`.

Core-05 compat adapter **never** enables that option. Tests assert:

- `lockedPlayerIds` alone does not freeze the roster
- Lineup fields are not imported as members

---

## 4. Future write integration (not Phase 1)

Any Core-05 → TT write bridge requires Owner approval, dual-write/cutover plan, and must not break existing TT behavior.
