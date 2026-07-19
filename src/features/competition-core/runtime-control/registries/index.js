/**
 * Runtime control registries (Phase 3A.3).
 * Integrator-owned. Empty stubs — no Production wiring.
 */

export {
  REGISTRY_REASON_CODE,
  REGISTRY_REASON_CODE_VALUES,
  isRegistryReasonCode,
} from "./registryReasonCodes.js";

export {
  CAPABILITY_EXECUTOR_REGISTRY_VERSION,
  createCapabilityExecutorRegistry,
  defaultCapabilityExecutorRegistry,
  registerCapabilityExecutor,
  resolveCapabilityExecutor,
  getCapabilityExecutorRegistration,
  listCapabilityExecutorRegistrations,
  isCapabilityExecutorRegistryEmpty,
  unregisterCapabilityExecutor,
  freezeCapabilityExecutorRegistry,
  isCapabilityExecutorRegistryFrozen,
  resetCapabilityExecutorRegistryForTests,
} from "./capabilityExecutors.js";

export {
  PARTICIPANT_CAPABILITY_WAVE1_VERSION,
  PARTICIPANT_CAPABILITY_MODULE_PATHS,
  registerParticipantCapabilityWave1,
} from "./participantCapabilityRegistration.js";
