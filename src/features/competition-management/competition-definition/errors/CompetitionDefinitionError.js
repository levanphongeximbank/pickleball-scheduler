/**
 * CM-01 Competition Definition — typed domain / application error.
 */

import { COMPETITION_DEFINITION_ERROR_CODE } from "./errorCodes.js";

export class CompetitionDefinitionError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "CompetitionDefinitionError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" ? { ...details } : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is CompetitionDefinitionError}
 */
export function isCompetitionDefinitionError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name === "CompetitionDefinitionError"
  );
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isCompetitionDefinitionErrorCode(code) {
  return Object.values(COMPETITION_DEFINITION_ERROR_CODE).includes(String(code));
}
