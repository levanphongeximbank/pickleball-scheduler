/**
 * CORE-18 — typed STANDINGS_* errors and warnings (never RESULT_* / MATCH_* / SCORING_*).
 */

export const STANDINGS_ERROR_CODE = Object.freeze({
  STANDINGS_EMPTY_ENTRY_ROSTER: "STANDINGS_EMPTY_ENTRY_ROSTER",
  STANDINGS_DUPLICATE_ENTRY_IDENTITY: "STANDINGS_DUPLICATE_ENTRY_IDENTITY",
  STANDINGS_DUPLICATE_MATCH_IDENTITY: "STANDINGS_DUPLICATE_MATCH_IDENTITY",
  STANDINGS_CONFLICTING_ACCEPTED_RESULTS: "STANDINGS_CONFLICTING_ACCEPTED_RESULTS",
  STANDINGS_RESULT_NOT_STANDINGS_SAFE: "STANDINGS_RESULT_NOT_STANDINGS_SAFE",
  STANDINGS_MISSING_WINNER_LOSER: "STANDINGS_MISSING_WINNER_LOSER",
  STANDINGS_PARTICIPANT_OUTSIDE_GROUP: "STANDINGS_PARTICIPANT_OUTSIDE_GROUP",
  STANDINGS_MISSING_REQUIRED_STATISTICS: "STANDINGS_MISSING_REQUIRED_STATISTICS",
  STANDINGS_MISSING_RULE_SET: "STANDINGS_MISSING_RULE_SET",
  STANDINGS_UNSUPPORTED_TIEBREAK_CRITERION: "STANDINGS_UNSUPPORTED_TIEBREAK_CRITERION",
  STANDINGS_INVALID_DETERMINISTIC_FALLBACK: "STANDINGS_INVALID_DETERMINISTIC_FALLBACK",
  STANDINGS_INVALID_REQUEST: "STANDINGS_INVALID_REQUEST",
});

/** @type {ReadonlySet<string>} */
export const STANDINGS_ERROR_CODE_VALUES = new Set(
  Object.values(STANDINGS_ERROR_CODE)
);

export const STANDINGS_WARNING_CODE = Object.freeze({
  STANDINGS_RESULT_EXCLUDED: "STANDINGS_RESULT_EXCLUDED",
  STANDINGS_DIFFERENTIAL_SKIPPED: "STANDINGS_DIFFERENTIAL_SKIPPED",
  STANDINGS_STATISTICS_ABSENT: "STANDINGS_STATISTICS_ABSENT",
  STANDINGS_LEGACY_RESULT_TYPE: "STANDINGS_LEGACY_RESULT_TYPE",
  STANDINGS_QUALIFICATION_LEGACY: "STANDINGS_QUALIFICATION_LEGACY",
  STANDINGS_UNRESOLVED_TIE: "STANDINGS_UNRESOLVED_TIE",
});

/** @type {ReadonlySet<string>} */
export const STANDINGS_WARNING_CODE_VALUES = new Set(
  Object.values(STANDINGS_WARNING_CODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isStandingsErrorCode(value) {
  return typeof value === "string" && STANDINGS_ERROR_CODE_VALUES.has(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isStandingsWarningCode(value) {
  return typeof value === "string" && STANDINGS_WARNING_CODE_VALUES.has(value);
}

export class StandingsError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isStandingsErrorCode(code)
      ? code
      : STANDINGS_ERROR_CODE.STANDINGS_INVALID_REQUEST;
    super(String(message || safeCode));
    this.name = "StandingsError";
    this.code = safeCode;
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is StandingsError}
 */
export function isStandingsError(err) {
  return err instanceof StandingsError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {StandingsError}
 */
export function createStandingsError(code, message, details) {
  return new StandingsError(code, message, details);
}

/**
 * Stable typed issue for result payloads (errors and warnings).
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 */
export function createStandingsIssue(code, message, details = {}) {
  return Object.freeze({
    code: String(code),
    message: String(message || code),
    details:
      details && typeof details === "object" && !Array.isArray(details)
        ? Object.freeze({ ...details })
        : Object.freeze({}),
  });
}
