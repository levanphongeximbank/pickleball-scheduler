import {
  REGISTRATION_RUNTIME_ERROR_CODE,
  isRegistrationRuntimeErrorCode,
} from "./runtimeErrorCodes.js";

/**
 * Typed runtime error — never use bare Error for registration resolve failures.
 */
export class RegistrationRuntimeError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isRegistrationRuntimeErrorCode(code)
      ? code
      : REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION;
    super(String(message || safeCode));
    this.name = "RegistrationRuntimeError";
    this.code = safeCode;
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is RegistrationRuntimeError}
 */
export function isRegistrationRuntimeError(err) {
  return err instanceof RegistrationRuntimeError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {RegistrationRuntimeError}
 */
export function createRegistrationRuntimeError(code, message, details) {
  return new RegistrationRuntimeError(code, message, details);
}
