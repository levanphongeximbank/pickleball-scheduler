# Export Surface — Phase 3B Integrator Wave 1

## Capability-local

`participants/runtime/index.js` (owned by Chat 1; unchanged in Wave 1 except consumption)

## Participant barrel (Integrator)

`participants/index.js` re-exports approved public runtime factories/contracts.

`participants/contracts/index.js` re-exports identity helpers:

- `buildParticipantIdentityKey`
- `createParticipantIdentity`
- `identityFromCompetitionParticipant`

## Root Competition Core

`competition-core/index.js` re-exports:

### Runtime

- `createParticipantResolver`
- `createLegacyParticipantAdapter`
- `createParticipantResolveRequest` / `createParticipantResolveResult`
- `resolveOk` / `resolveFail`
- `PARTICIPANT_ADAPTER_ID` / `isParticipantAdapter`
- `PARTICIPANT_RUNTIME_ERROR_CODE` (+ helpers / `ParticipantRuntimeError`)
- `LEGACY_PLAYER_SOURCE_TYPE` / `isLegacyPlayerSource` / `mapLegacyPlayerToCompetitionParticipant`
- Persistence port stubs (non-Production) — **not** re-exported at root;
  remain available only via `participants/runtime/index.js` (capability-local)

### Identity

- `buildParticipantIdentityKey`
- `createParticipantIdentity`
- `identityFromCompetitionParticipant`

### Registration (explicit)

- `registerParticipantCapabilityWave1`
- `PARTICIPANT_CAPABILITY_WAVE1_VERSION`
- `PARTICIPANT_CAPABILITY_MODULE_PATHS`

## Rules

- No duplicate export names
- No circular dependency introduced
- No import-time registration
- Legacy consumers of pre-3B exports unchanged
