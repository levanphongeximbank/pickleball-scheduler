import { FINANCE_ERROR_CODES, isFinanceErrorCode } from "./codes.js";

/**
 * Typed Finance domain error.
 * Context must stay free of secrets, raw provider payloads, and personal profile data.
 */
export class FinanceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {object} [context]
   */
  constructor(code, message, context = undefined) {
    super(message);
    this.name = "FinanceError";
    this.code = isFinanceErrorCode(code) ? code : FINANCE_ERROR_CODES.INVALID_INPUT;
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
export function throwFinanceError(code, message, context) {
  throw new FinanceError(code, message, context);
}

/**
 * @param {unknown} err
 * @returns {err is FinanceError}
 */
export function isFinanceError(err) {
  return err instanceof FinanceError;
}
