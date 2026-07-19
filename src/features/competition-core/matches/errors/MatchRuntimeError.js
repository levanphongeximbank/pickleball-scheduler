import {
  MATCH_RUNTIME_ERROR_CODE,
  isMatchRuntimeErrorCode,
} from "./runtimeErrorCodes.js";

/**
 * Typed runtime error — never use bare Error for match resolve failures.
 */
export class MatchRuntimeError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isMatchRuntimeErrorCode(code)
      ? code
      : MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT;
    super(String(message || safeCode));
    this.name = "MatchRuntimeError";
    this.code = safeCode;
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is MatchRuntimeError}
 */
export function isMatchRuntimeError(err) {
  return err instanceof MatchRuntimeError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {MatchRuntimeError}
 */
export function createMatchRuntimeError(code, message, details) {
  return new MatchRuntimeError(code, message, details);
}
