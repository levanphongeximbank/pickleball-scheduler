/**
 * CM-03 Competition Versioning — typed domain / application error.
 */

import { COMPETITION_VERSION_ERROR_CODE } from "./errorCodes.js";

export class CompetitionVersionError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "CompetitionVersionError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" ? { ...details } : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is CompetitionVersionError}
 */
export function isCompetitionVersionError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name === "CompetitionVersionError"
  );
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isCompetitionVersionErrorCode(code) {
  return Object.values(COMPETITION_VERSION_ERROR_CODE).includes(String(code));
}
