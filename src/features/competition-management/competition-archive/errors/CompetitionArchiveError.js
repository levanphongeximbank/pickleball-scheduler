/**
 * CM-08 Competition Archive — typed domain / application error.
 */

import { COMPETITION_ARCHIVE_ERROR_CODE } from "./errorCodes.js";

export class CompetitionArchiveError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "CompetitionArchiveError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" ? { ...details } : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is CompetitionArchiveError}
 */
export function isCompetitionArchiveError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name === "CompetitionArchiveError"
  );
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isCompetitionArchiveErrorCode(code) {
  return Object.values(COMPETITION_ARCHIVE_ERROR_CODE).includes(String(code));
}
