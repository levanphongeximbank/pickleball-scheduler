/**
 * Phase 3B — Participant Resolution Runtime (capability-local public surface).
 * Integrator owns root competition-core/index.js re-exports — do not edit that here.
 */

export {
  createParticipantResolver,
  ParticipantResolver,
} from "./ParticipantResolver.js";

export {
  createLegacyParticipantAdapter,
  LegacyParticipantAdapter,
} from "./adapters/index.js";

export {
  createParticipantResolveRequest,
  createParticipantResolveResult,
  resolveOk,
  resolveFail,
  PARTICIPANT_ADAPTER_ID,
  isParticipantAdapter,
} from "./contracts/index.js";

export {
  PARTICIPANT_RUNTIME_ERROR_CODE,
  PARTICIPANT_RUNTIME_ERROR_CODE_VALUES,
  isParticipantRuntimeErrorCode,
  ParticipantRuntimeError,
  isParticipantRuntimeError,
  createParticipantRuntimeError,
} from "./errors/index.js";

export {
  LEGACY_PLAYER_SOURCE_TYPE,
  isLegacyPlayerSource,
  inferLegacyPersonKind,
  mapLegacyPlayerToCompetitionParticipant,
} from "./mappers/index.js";

export {
  PARTICIPANT_PERSISTENCE_PORT_METHODS,
  matchesParticipantPersistencePort,
  createInMemoryParticipantPersistencePort,
  createNoopParticipantPersistencePort,
} from "./ports/index.js";

export {
  createIdentityLookup,
  requireParticipantIdentity,
  normalizeAndValidateParticipant,
  assertGuestPreserved,
} from "./services/index.js";

export {
  resolveShadow,
  normalizeParticipantShadowPayload,
  compareParticipantShadowPayloads,
} from "./shadow/index.js";
