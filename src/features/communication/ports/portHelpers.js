/**
 * Shared helpers for Communication Foundation ports (COMMS-01).
 * Ports fail clearly when operations are unimplemented.
 * No Supabase. No Notification runtime. No Club/Identity writes.
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";

/**
 * @param {string} portName
 * @param {string} operation
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function throwPortUnimplemented(portName, operation, details = {}) {
  throw new CommunicationFoundationError(
    COMMUNICATION_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
    `${portName}.${operation} is unimplemented in Communication Foundation COMMS-01`,
    { portName, operation, ...details }
  );
}

/**
 * @param {unknown} port
 * @param {readonly string[]} methodNames
 * @returns {boolean}
 */
export function matchesPortMethods(port, methodNames) {
  if (!port || typeof port !== "object") return false;
  return methodNames.every(
    (name) =>
      typeof /** @type {Record<string, unknown>} */ (port)[name] === "function"
  );
}
