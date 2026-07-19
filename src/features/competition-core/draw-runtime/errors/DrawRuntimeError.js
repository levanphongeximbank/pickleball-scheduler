import {
  DRAW_RUNTIME_ERROR_CODE,
  isDrawRuntimeErrorCode,
} from "./runtimeErrorCodes.js";

/**
 * Typed runtime error — never use bare Error for draw resolve failures.
 */
export class DrawRuntimeError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isDrawRuntimeErrorCode(code)
      ? code
      : DRAW_RUNTIME_ERROR_CODE.DRAW_INVALID_INPUT;
    super(String(message || safeCode));
    this.name = "DrawRuntimeError";
    this.code = safeCode;
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is DrawRuntimeError}
 */
export function isDrawRuntimeError(err) {
  return err instanceof DrawRuntimeError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {DrawRuntimeError}
 */
export function createDrawRuntimeError(code, message, details) {
  return new DrawRuntimeError(code, message, details);
}
