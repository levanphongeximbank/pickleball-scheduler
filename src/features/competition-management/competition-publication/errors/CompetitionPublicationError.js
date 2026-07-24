/**
 * CM-06 Competition Publication — typed domain / application error.
 */

import { COMPETITION_PUBLICATION_ERROR_CODE } from "./errorCodes.js";

export class CompetitionPublicationError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "CompetitionPublicationError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" ? { ...details } : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is CompetitionPublicationError}
 */
export function isCompetitionPublicationError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name === "CompetitionPublicationError"
  );
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isCompetitionPublicationErrorCode(code) {
  return Object.values(COMPETITION_PUBLICATION_ERROR_CODE).includes(String(code));
}
