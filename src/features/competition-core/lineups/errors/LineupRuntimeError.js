import {
  LINEUP_RUNTIME_ERROR_CODE,
  isLineupRuntimeErrorCode,
} from "./runtimeErrorCodes.js";

/**
 * Typed runtime error — never use bare Error for lineup resolve failures.
 */
export class LineupRuntimeError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isLineupRuntimeErrorCode(code)
      ? code
      : LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP;
    super(String(message || safeCode));
    this.name = "LineupRuntimeError";
    this.code = safeCode;
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is LineupRuntimeError}
 */
export function isLineupRuntimeError(err) {
  return err instanceof LineupRuntimeError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {LineupRuntimeError}
 */
export function createLineupRuntimeError(code, message, details) {
  return new LineupRuntimeError(code, message, details);
}
