# Ownership Manifest — Phase 3C

## Owned (capability)

- `src/features/competition-core/registrations/**`
- `src/features/competition-core/participants/contracts/entryRegistration.js`
- `tests/competition-core-registration-3c*.test.js`
- `scripts/ci/unit-test-files.phase-3c.json`
- `docs/competition-engine/phase-3c/**`

## Protected (do not touch)

- `src/features/competition-core/index.js`
- Participant barrels / validators/mappings/ports/dto index files
- `runtime-control/**` registries
- `scripts/ci/unit-test-files.json`
- App boot, flags, Production routes
- `identity.js` / `competitionParticipant.js` (3B freeze)

## Read-only consumption

- Participant domain enums/contracts for references + status enums
- Participant Runtime **only** via injected callback (no import)
