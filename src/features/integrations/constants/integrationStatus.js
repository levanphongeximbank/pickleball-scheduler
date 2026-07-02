/** Phase 11A — tenant integration lifecycle (UI + settings). */
export const INTEGRATION_STATUS = Object.freeze({
  DISABLED: "disabled",
  CONFIGURED: "configured",
  ERROR: "error",
  MOCK_ONLY: "mock_only",
});

export function isIntegrationOperational(status) {
  return status === INTEGRATION_STATUS.CONFIGURED || status === INTEGRATION_STATUS.MOCK_ONLY;
}
