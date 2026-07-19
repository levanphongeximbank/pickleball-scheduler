export * from "./enums/index.js";
export * from "./contracts/index.js";
export * from "./validators/index.js";
export * from "./dto/index.js";
export * from "./mappings/index.js";
export * from "./ports/index.js";
export { PARTICIPANT_ERROR_CODE } from "./errors/errorCodes.js";
export {
  createParticipantValidationResult,
  validationOk,
  validationFail,
  validationError,
  validationWarning,
} from "./results/validationResult.js";

/** Core-02 — shadow compatibility adapters (participants-local; not mega-barrel). */
export {
  inferCompetitionEntryType,
  mapLegacyIndividualStatusToEntryStatus,
  mapLegacyIndividualEntryToCompetitionEntry,
  mapTeamTournamentTeamToOptionalEntry,
  mapDailyPlayPlayerWithoutEntry,
  assertDailyPlayMapsWithoutEntries,
  mapPlayerProfileToParticipantReference,
  mapClubScopeToEntryTenantScope,
} from "./compatibility/index.js";

/** Phase 3B — Participant Resolution Runtime (public surface; Integrator-owned barrel). */
export {
  createParticipantResolver,
  createLegacyParticipantAdapter,
  createParticipantResolveRequest,
  createParticipantResolveResult,
  resolveOk,
  resolveFail,
  PARTICIPANT_ADAPTER_ID,
  isParticipantAdapter,
  PARTICIPANT_RUNTIME_ERROR_CODE,
  PARTICIPANT_RUNTIME_ERROR_CODE_VALUES,
  isParticipantRuntimeErrorCode,
  ParticipantRuntimeError,
  isParticipantRuntimeError,
  createParticipantRuntimeError,
  LEGACY_PLAYER_SOURCE_TYPE,
  isLegacyPlayerSource,
  mapLegacyPlayerToCompetitionParticipant,
} from "./runtime/index.js";
