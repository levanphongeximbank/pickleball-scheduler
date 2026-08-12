/**
 * P1.2 S1-D/S1-E setup mutation foundation public surface.
 */

export {
  SETUP_MUTATION_CODES,
  SETUP_MUTATION_STATUS,
} from "./setupMutationCodes.js";

export {
  SETUP_MUTATION_GATE_ENV,
  SETUP_MUTATION_GATE_META,
  V7_GATE_RETIREMENT_RECOMMENDATION,
  isSetupMutationFoundationEnabled,
  rejectIfSetupMutationGateOff,
} from "./setupMutationFeatureGate.js";

export {
  SETUP_FORM_REHYDRATE_REASON,
  decideSetupFormRehydration,
  buildFormatVenueFingerprint,
  buildTiebreakOrderFingerprint,
} from "./setupFormRehydration.js";

export {
  SETUP_MUTATION_RPC_BY_COMMAND,
  SETUP_MUTATION_RPC_NAMES,
  resolveSetupMutationRpcName,
  isSetupMutationRpcDeployed,
  isSetupDomainWriteMethodActive,
  listRegisteredSetupCommands,
} from "./setupMutationRpcRegistry.js";

export {
  evaluateSetupDriftPolicy,
  evaluateEngineVersionPolicy,
} from "./setupMutationPolicy.js";

export {
  executeSetupMutation,
  normalizeSetupMutationRpcResult,
} from "./executeSetupMutation.js";

export {
  buildSetupMutationSnapshotPackage,
  buildSetupMutationSnapshotPackageAsync,
  attachSnapshotPackageToPayload,
} from "./buildSetupMutationSnapshotPackage.js";

export {
  buildSetupMutationFromTeamDataDiff,
} from "./inferSetupMutationCommand.js";

export {
  CLOSE_DEFAULT_REASON,
  CLOSE_NOT_PERSISTED_CODE,
  CLOSE_TOURNAMENT_COMMAND,
  buildCloseTournamentPayload,
  isCloseMutationPersisted,
  resolveCloseMutationOutcome,
} from "./closeTournamentMutation.js";

export {
  buildSetupMutationPayload,
  buildSetupMutationPayloadAsync,
  previewSetupMutation,
  previewSetupMutationAsync,
  confirmSetupMutation,
  runSetupMutation,
  handleSetupMutationConflict,
  shouldIgnoreStaleSetupMutationResponse,
  __resetSetupMutationFoundationStateForTests,
} from "./runSetupMutation.js";
