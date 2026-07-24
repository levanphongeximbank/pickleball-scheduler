/**
 * CM-07 Competition Suspension / Cancellation — typed domain / application error.
 */

import { COMPETITION_LIFECYCLE_ERROR_CODE } from "./errorCodes.js";

export class CompetitionLifecycleError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "CompetitionLifecycleError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" ? { ...details } : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is CompetitionLifecycleError}
 */
export function isCompetitionLifecycleError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name === "CompetitionLifecycleError"
  );
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isCompetitionLifecycleErrorCode(code) {
  return Object.values(COMPETITION_LIFECYCLE_ERROR_CODE).includes(String(code));
}
