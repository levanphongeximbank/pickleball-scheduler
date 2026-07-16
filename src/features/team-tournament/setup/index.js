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
  isSetupMutationFoundationEnabled,
  rejectIfSetupMutationGateOff,
} from "./setupMutationFeatureGate.js";

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
  buildSetupMutationPayload,
  previewSetupMutation,
  confirmSetupMutation,
  runSetupMutation,
  handleSetupMutationConflict,
  shouldIgnoreStaleSetupMutationResponse,
  __resetSetupMutationFoundationStateForTests,
} from "./runSetupMutation.js";
