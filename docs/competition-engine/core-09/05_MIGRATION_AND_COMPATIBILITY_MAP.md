# CORE-09 — Migration and Compatibility Map

**Phase 1B position:** document only — **no production path changes**.

## Canonical candidates

| Surface | Position |
|---------|----------|
| Individual group round robin | **Primary canonical candidate** for first executor phase |
| Individual knockout (single elimination) | Canonical candidate after RR |
| Team Tournament team fixtures | **Adapter required** — must not move lineup/time logic into CORE-09 |
| Daily Play | **Deferred / format-owned** until stable identity + ownership resolved |
| Partner formation / matchmaking | **Outside CORE-09** — consume outputs only |

## Legacy surfaces (do not modify in Phase 1B)

| Legacy path | Notes |
|-------------|-------|
| `src/tournament/engines/scheduleEngine.js` | Scheduling + historical fixture orchestration |
| `src/pages/tournament.fixtures.logic.js` | Round-robin fixture builder used by schedule paths |
| `src/features/tournament-engine/engines/scheduleEngine.js` | TE schedule generator |
| `src/features/team-tournament/engines/teamRoundRobinScheduleEngine.js` | TT fixtures — adapter later |
| Private-pairing runtime | Format / pairing owned — not Match Generator |
| Formation / matchmaking adapters | Remain outside CORE-09 |

Inventory reference (historical CC-09 scheduling, not CORE-09 Match Generator):

`src/features/competition-core/scheduling/adapters/schedulingRuntimeInventory.js`

## Reverse dependency (document for later extraction)

`scheduleEngine` → `pages/tournament.fixtures.logic.js` is a reverse / page-layer dependency.

**Phase 1B:** document only.  
**Later:** extract fixture logic behind CORE-09 ports/executors; do not refactor in this phase.

## Compatibility stance

- Existing production paths remain authoritative until Owner-approved cutover.
- CORE-09 Phase 1B is additive and dormant.
- Team Tournament must keep lineup visibility, deadlines, and clock concerns in CORE-06 / TT product layers.
- Daily Play remains out of scope until identity ownership is decided.
