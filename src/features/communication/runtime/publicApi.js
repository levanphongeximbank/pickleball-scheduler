/**
 * Communication runtime public API (safe for node:test — no JSX).
 */

export {
  COMMUNICATION_RUNTIME_MODE,
  COMMUNICATION_RUNTIME_MODE_VALUES,
  COMMUNICATION_RUNTIME_PHASE,
  PRODUCTION_GATEWAY_MARKER,
  UNAVAILABLE_GATEWAY_MARKER,
  COMMUNICATION_RUNTIME_UNAVAILABLE_USER_MESSAGE,
  COMMUNICATION_EXPERIENCE_ERROR_CODE,
} from "./constants.js";

export {
  resolveCommunicationRuntimeMode,
  isCommunicationRuntimeMode,
} from "./resolveCommunicationRuntimeMode.js";

export {
  mapToCommunicationExperienceError,
  createSafeCommunicationDiagnosticEvent,
  createRuntimeNotActivatedError,
} from "./experienceErrors.js";

export { createUnavailableMessagingExperienceGateway } from "./createUnavailableMessagingExperienceGateway.js";
export { createProductionMessagingExperienceGateway } from "./createProductionMessagingExperienceGateway.js";

export {
  bootstrapCommunicationRuntime,
  getCommunicationRuntimeStatus,
  getCommunicationRuntimeGateway,
  resetCommunicationRuntime,
  setCommunicationRuntimeAuthenticated,
} from "./communicationRuntime.js";
