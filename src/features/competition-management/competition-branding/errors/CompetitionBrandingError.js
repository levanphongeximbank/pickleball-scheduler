/**
 * CM-05 Competition Branding — typed domain / application error.
 */

import { COMPETITION_BRANDING_ERROR_CODE } from "./errorCodes.js";

export class CompetitionBrandingError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "CompetitionBrandingError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" ? { ...details } : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is CompetitionBrandingError}
 */
export function isCompetitionBrandingError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name === "CompetitionBrandingError"
  );
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isCompetitionBrandingErrorCode(code) {
  return Object.values(COMPETITION_BRANDING_ERROR_CODE).includes(String(code));
}
