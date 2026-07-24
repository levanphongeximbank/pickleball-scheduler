/**
 * CM-02 Template Selection & Instantiation — typed domain / application error.
 */

import { COMPETITION_TEMPLATE_ERROR_CODE } from "./errorCodes.js";

export class CompetitionTemplateError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "CompetitionTemplateError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" ? { ...details } : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is CompetitionTemplateError}
 */
export function isCompetitionTemplateError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name === "CompetitionTemplateError"
  );
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isCompetitionTemplateErrorCode(code) {
  return Object.values(COMPETITION_TEMPLATE_ERROR_CODE).includes(String(code));
}
