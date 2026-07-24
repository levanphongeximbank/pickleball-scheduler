/**
 * Communication Foundation runtime modes & markers (COMMS-07).
 * Fail-closed Production: never auto-fallback to demo.
 */

export const COMMUNICATION_RUNTIME_MODE = Object.freeze({
  DEMO: "DEMO",
  PRODUCTION: "PRODUCTION",
  UNAVAILABLE: "UNAVAILABLE",
});

export const COMMUNICATION_RUNTIME_MODE_VALUES = Object.freeze(
  Object.values(COMMUNICATION_RUNTIME_MODE)
);

export const COMMUNICATION_RUNTIME_PHASE = Object.freeze({
  id: "COMMS-07",
  name: "integration-hardening-final-certification",
  priorPhase: "COMMS-06",
  structureComplete: true,
  localDemoReady: true,
  productionGatewayWired: true,
  remotePersistenceActivated: false,
  clientRlsPolicy: "FAIL_CLOSED",
  realtimePublicationEnabled: false,
  productionBlocked: true,
});

export const PRODUCTION_GATEWAY_MARKER = Object.freeze({
  adapterKind: "PRODUCTION_COMPOSITION",
  productionReady: true,
  remotePersistenceActive: false,
  remoteRealtimeActive: false,
  note:
    "COMMS-07 production-oriented gateway — injected deps only; remote Staging/Production not activated",
});

export const UNAVAILABLE_GATEWAY_MARKER = Object.freeze({
  adapterKind: "RUNTIME_UNAVAILABLE",
  productionReady: false,
  remotePersistenceActive: false,
  remoteRealtimeActive: false,
  note:
    "Communication runtime not activated — fail-closed; no demo data in Production",
});

/** User-facing copy — no internal config / stack / env leakage. */
export const COMMUNICATION_RUNTIME_UNAVAILABLE_USER_MESSAGE =
  "Tính năng chưa được kích hoạt";

export const COMMUNICATION_EXPERIENCE_ERROR_CODE = Object.freeze({
  UNAUTHORIZED: "COMMUNICATION_EXPERIENCE_UNAUTHORIZED",
  FORBIDDEN: "COMMUNICATION_EXPERIENCE_FORBIDDEN",
  NOT_ACTIVATED: "COMMUNICATION_EXPERIENCE_NOT_ACTIVATED",
  NETWORK_UNAVAILABLE: "COMMUNICATION_EXPERIENCE_NETWORK_UNAVAILABLE",
  CONFLICT: "COMMUNICATION_EXPERIENCE_CONFLICT",
  VALIDATION_FAILURE: "COMMUNICATION_EXPERIENCE_VALIDATION_FAILURE",
  STALE_RELOAD_REQUIRED: "COMMUNICATION_EXPERIENCE_STALE_RELOAD_REQUIRED",
  UNKNOWN: "COMMUNICATION_EXPERIENCE_UNKNOWN",
});
