/**
 * CM-04 Competition Configuration — typed domain / application error.
 */

import { COMPETITION_CONFIGURATION_ERROR_CODE } from "./errorCodes.js";

export class CompetitionConfigurationError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "CompetitionConfigurationError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" ? { ...details } : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is CompetitionConfigurationError}
 */
export function isCompetitionConfigurationError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name === "CompetitionConfigurationError"
  );
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isCompetitionConfigurationErrorCode(code) {
  return Object.values(COMPETITION_CONFIGURATION_ERROR_CODE).includes(String(code));
}
