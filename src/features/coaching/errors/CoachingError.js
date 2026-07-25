import {
  COACHING_ERROR_CODES,
  isCoachingErrorCode,
} from "../constants/errorCodes.js";

/**
 * Typed Coaching domain / application error.
 * Context must stay free of secrets and foreign-module profile payloads.
 */
export class CoachingError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {object} [context]
   */
  constructor(code, message, context = undefined) {
    super(message);
    this.name = "CoachingError";
    this.code = isCoachingErrorCode(code)
      ? code
      : COACHING_ERROR_CODES.INVALID_INPUT;
    this.context =
      context && typeof context === "object" && !Array.isArray(context)
        ? Object.freeze({ ...context })
        : undefined;
  }
}

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {never}
 */
export function throwCoachingError(code, message, context) {
  throw new CoachingError(code, message, context);
}

/**
 * @param {unknown} err
 * @returns {err is CoachingError}
 */
export function isCoachingError(err) {
  return err instanceof CoachingError;
}

/**
 * Result-style failure (authorization helpers).
 *
 * @param {string} code
 * @param {string} message
 * @param {object} [details]
 * @returns {{ ok: false, code: string, error: string, details?: object }}
 */
export function coachingFailure(code, message, details = undefined) {
  const result = { ok: false, code, error: message };
  if (details !== undefined) result.details = details;
  return result;
}
