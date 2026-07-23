import { AUTHORIZATION_ERROR_CODE } from "./errorCodes.js";

export class AuthorizationError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code || AUTHORIZATION_ERROR_CODE.EVALUATION_FAILED;
    this.details = Object.freeze({ ...details });
  }
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isAuthorizationError(error) {
  return (
    error instanceof AuthorizationError ||
    (Boolean(error) &&
      typeof error === "object" &&
      error.name === "AuthorizationError" &&
      typeof error.code === "string")
  );
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {AuthorizationError}
 */
export function createAuthorizationError(code, message, details) {
  return new AuthorizationError(code, message, details);
}
