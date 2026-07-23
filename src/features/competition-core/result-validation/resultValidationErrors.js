/**
 * CORE-17 — typed RESULT_* errors (never MATCH_* / SCORING_*).
 */

export const RESULT_ERROR_CODE = Object.freeze({
  RESULT_INVALID_SCHEMA: "RESULT_INVALID_SCHEMA",
  RESULT_INVALID_RESULT_TYPE: "RESULT_INVALID_RESULT_TYPE",
  RESULT_INVALID_OUTCOME: "RESULT_INVALID_OUTCOME",
  RESULT_INVALID_ACCEPTANCE_TRANSITION: "RESULT_INVALID_ACCEPTANCE_TRANSITION",
  RESULT_DRAW_NOT_SUPPORTED: "RESULT_DRAW_NOT_SUPPORTED",
  RESULT_WINNER_REQUIRED: "RESULT_WINNER_REQUIRED",
  RESULT_WINNER_FORBIDDEN: "RESULT_WINNER_FORBIDDEN",
  RESULT_WINNER_MISMATCH: "RESULT_WINNER_MISMATCH",
  RESULT_LOSER_REQUIRED: "RESULT_LOSER_REQUIRED",
  RESULT_SIDE_BINDING_INVALID: "RESULT_SIDE_BINDING_INVALID",
  RESULT_SCORE_REF_REQUIRED: "RESULT_SCORE_REF_REQUIRED",
  RESULT_SCORE_REF_INVALID: "RESULT_SCORE_REF_INVALID",
  RESULT_SCORE_SNAPSHOT_INCONSISTENT: "RESULT_SCORE_SNAPSHOT_INCONSISTENT",
  RESULT_PROJECTION_NOT_TERMINAL: "RESULT_PROJECTION_NOT_TERMINAL",
  RESULT_TECHNICAL_METADATA_REQUIRED: "RESULT_TECHNICAL_METADATA_REQUIRED",
  RESULT_TECHNICAL_SUBTYPE_REQUIRED: "RESULT_TECHNICAL_SUBTYPE_REQUIRED",
  RESULT_ACTOR_REQUIRED: "RESULT_ACTOR_REQUIRED",
  RESULT_SOURCE_INVALID: "RESULT_SOURCE_INVALID",
  RESULT_ACCEPTANCE_NOT_ALLOWED: "RESULT_ACCEPTANCE_NOT_ALLOWED",
  RESULT_ALREADY_ACCEPTED_ACTIVE: "RESULT_ALREADY_ACCEPTED_ACTIVE",
  RESULT_SUPERSEDE_TARGET_INVALID: "RESULT_SUPERSEDE_TARGET_INVALID",
  RESULT_CONCURRENT_CORRECTION: "RESULT_CONCURRENT_CORRECTION",
  RESULT_IDEMPOTENT_REPLAY_MISMATCH: "RESULT_IDEMPOTENT_REPLAY_MISMATCH",
  RESULT_UNSUPPORTED_NO_CONTEST_ENUM: "RESULT_UNSUPPORTED_NO_CONTEST_ENUM",
});

/** @type {ReadonlySet<string>} */
export const RESULT_ERROR_CODE_VALUES = new Set(
  Object.values(RESULT_ERROR_CODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isResultErrorCode(value) {
  return typeof value === "string" && RESULT_ERROR_CODE_VALUES.has(value);
}

export class ResultValidationError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isResultErrorCode(code)
      ? code
      : RESULT_ERROR_CODE.RESULT_INVALID_SCHEMA;
    super(String(message || safeCode));
    this.name = "ResultValidationError";
    this.code = safeCode;
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is ResultValidationError}
 */
export function isResultValidationError(err) {
  return err instanceof ResultValidationError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {ResultValidationError}
 */
export function createResultValidationError(code, message, details) {
  return new ResultValidationError(code, message, details);
}
