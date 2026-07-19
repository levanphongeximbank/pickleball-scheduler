# Ownership Manifest — Phase 3D

## Owned (capability)

- `src/features/competition-core/teams/**`
- `src/features/competition-core/participants/contracts/teamRosterLineup.js` (team/roster `identityKey` only; lineup sections read-only)
- `tests/competition-core-team-runtime-3d*.test.js`
- `scripts/ci/unit-test-files.phase-3d.json`
- `docs/competition-engine/phase-3d/**`

## Protected (do not touch)

- `src/features/competition-core/index.js`
- Participant barrels / validators/mappings/ports/dto index files
- `runtime-control/**` registries
- `scripts/ci/unit-test-files.json`
- App boot, flags, Production routes
- `identity.js` / `competitionParticipant.js` (3B freeze)
- `entryRegistration.js` / `registrations/**` (3C freeze)
- Lineup engines / lineup contract mutation (3E)

## Read-only consumption

- Participant reference factories / enums
- Participant Runtime **only** via injected callback (no import)
- Format `teamTournamentParticipantAdapters` — leave map-only; do not rewrite
