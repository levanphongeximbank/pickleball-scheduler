# Ownership Manifest — Phase 3E

## Owned (capability)

- `src/features/competition-core/lineups/**`
- `src/features/competition-core/participants/contracts/teamRosterLineup.js` (lineup `identityKey` / `rosterId` only)
- `tests/competition-core-lineup-runtime-3e*.test.js`
- `scripts/ci/unit-test-files.phase-3e.json`
- `docs/competition-engine/phase-3e/**`

## Protected (do not touch)

- `src/features/competition-core/index.js`
- Participant barrels / validators/mappings/ports/dto index files
- `runtime-control/**` registries
- `scripts/ci/unit-test-files.json`
- App boot, flags, Production routes
- `identity.js` / `competitionParticipant.js` (3B freeze)
- `entryRegistration.js` / `registrations/**` (3C freeze)
- `teams/**` (3D freeze)
- Team Tournament lineup engines (Production)

## Read-only consumption

- Participant reference factories / enums / lineup factories
- Team / Roster Runtime **only** via injected callbacks (no import)
