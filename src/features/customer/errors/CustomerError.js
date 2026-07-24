import { CUSTOMER_ERROR_CODES, isCustomerErrorCode } from "./codes.js";

/**
 * Typed Customer Management domain error.
 * Context must stay free of credentials, secrets, and unrestricted PII dumps.
 */
export class CustomerError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {object} [context]
   */
  constructor(code, message, context = undefined) {
    super(message);
    this.name = "CustomerError";
    this.code = isCustomerErrorCode(code) ? code : CUSTOMER_ERROR_CODES.INVALID_INPUT;
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
export function throwCustomerError(code, message, context) {
  throw new CustomerError(code, message, context);
}

/**
 * @param {unknown} err
 * @returns {err is CustomerError}
 */
export function isCustomerError(err) {
  return err instanceof CustomerError;
}
