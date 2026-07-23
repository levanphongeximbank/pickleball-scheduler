/**
 * CORE-16 — typed scoring engine error.
 */

import {
  SCORING_ERROR_CODE,
  isScoringErrorCode,
} from "./scoringErrorCodes.js";

export class ScoringEngineError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isScoringErrorCode(code)
      ? code
      : SCORING_ERROR_CODE.SCORING_INVALID_COMMAND;
    super(String(message || safeCode));
    this.name = "ScoringEngineError";
    this.code = safeCode;
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is ScoringEngineError}
 */
export function isScoringEngineError(err) {
  return err instanceof ScoringEngineError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {ScoringEngineError}
 */
export function createScoringEngineError(code, message, details) {
  return new ScoringEngineError(code, message, details);
}
