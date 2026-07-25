/**
 * Browser-safe trusted-backend public surface (no fs / no secrets).
 */

export {
  COMMUNICATION_TRUSTED_BACKEND_HOST,
  COMMUNICATION_TRUSTED_COMMAND,
  COMMUNICATION_TRUSTED_COMMAND_VALUES,
  COMMUNICATION_SYSTEM_PRODUCER_ID,
  COMMUNICATION_SYSTEM_ALLOWED_SOURCES,
  COMMUNICATION_ACT05_CAPABILITY_STATE,
  COMMUNICATION_SMOKE_FIXTURE_MARKER,
  COMMUNICATION_TRUSTED_BACKEND_ENV,
  COMMUNICATION_SERVER_ONLY_BOUNDARY,
} from "./constants.js";

export { mapCommunicationHttpError } from "./mapCommunicationHttpError.js";
export { createTrustedBackendHttpMessagingGateway } from "./createTrustedBackendHttpMessagingGateway.js";
