import {
  SEEDING_RUNTIME_ERROR_CODE,
  isSeedingRuntimeErrorCode,
} from "./runtimeErrorCodes.js";

/**
 * Typed runtime error — never use bare Error for seeding resolve failures.
 */
export class SeedingRuntimeError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isSeedingRuntimeErrorCode(code)
      ? code
      : SEEDING_RUNTIME_ERROR_CODE.SEEDING_INVALID_INPUT;
    super(String(message || safeCode));
    this.name = "SeedingRuntimeError";
    this.code = safeCode;
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is SeedingRuntimeError}
 */
export function isSeedingRuntimeError(err) {
  return err instanceof SeedingRuntimeError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {SeedingRuntimeError}
 */
export function createSeedingRuntimeError(code, message, details) {
  return new SeedingRuntimeError(code, message, details);
}
