/**
 * COMMS-05 explicit activation / integration gates.
 * Fail-closed: do not pretend remote RLS / realtime / notification are live.
 */

import { ACTIVATION_GATES } from "./schema.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";

export const COMMUNICATION_ACTIVATION_STATUS = Object.freeze({
  ...ACTIVATION_GATES,
  MIGRATION_STATUS: "AUTHORED_NOT_APPLIED",
  LOCAL_CODE_READY: true,
  STAGING_MIGRATION_READY: false,
  PRODUCTION_READY: false,
  REALTIME_ACTIVATION_READY: false,
});

/**
 * @param {string} gate
 * @param {string} [detail]
 */
export function assertActivationAllowed(gate, detail) {
  const status = ACTIVATION_GATES[gate] || COMMUNICATION_ACTIVATION_STATUS[gate];
  if (
    status === "DEFERRED_FAIL_CLOSED" ||
    status === "DEFERRED_NOT_ENABLED" ||
    status === "DEFERRED_STAGING_FIRST_GATE" ||
    status === "DEFERRED_INTEGRATION_GATE" ||
    status === "DEFERRED" ||
    status === "OWNER_APPROVAL_REQUIRED" ||
    status === "ACTIVATION_BLOCKER" ||
    status === false
  ) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.ACTIVATION_GATE_BLOCKED,
      `Communication activation gate blocked: ${gate}`,
      { gate, status: status == null ? null : String(status), detail }
    );
  }
}

/**
 * @returns {Readonly<object>}
 */
export function getCommunicationActivationSnapshot() {
  return Object.freeze({ ...COMMUNICATION_ACTIVATION_STATUS });
}
