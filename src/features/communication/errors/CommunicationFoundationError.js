/**
 * Communication Foundation — typed domain / contract error (COMMS-01).
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "./errorCodes.js";

export class CommunicationFoundationError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "CommunicationFoundationError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" ? { ...details } : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is CommunicationFoundationError}
 */
export function isCommunicationFoundationError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name ===
      "CommunicationFoundationError"
  );
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isCommunicationFoundationErrorCode(code) {
  return Object.values(COMMUNICATION_FOUNDATION_ERROR_CODE).includes(
    String(code)
  );
}
