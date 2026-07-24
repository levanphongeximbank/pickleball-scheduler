/**
 * E2E-04 Referee Operations typed errors — fail-closed.
 */

import { REFEREE_ERROR_CODE, REFEREE_ERROR_CODE_VALUES } from "./constants.js";

export class RefereeOperationsError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RefereeOperationsError";
    this.code =
      typeof code === "string" && code.trim()
        ? code.trim()
        : REFEREE_ERROR_CODE.UNKNOWN;
    this.failClosed = true;
    this.details = Object.freeze({ ...details });
  }
}

/**
 * @param {unknown} err
 * @returns {err is RefereeOperationsError}
 */
export function isRefereeOperationsError(err) {
  return (
    err instanceof RefereeOperationsError ||
    (Boolean(err) &&
      typeof err === "object" &&
      /** @type {{ name?: unknown }} */ (err).name === "RefereeOperationsError" &&
      typeof /** @type {{ code?: unknown }} */ (err).code === "string")
  );
}

/**
 * @param {unknown} code
 * @returns {boolean}
 */
export function isRefereeErrorCode(code) {
  return REFEREE_ERROR_CODE_VALUES.includes(String(code || ""));
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failReferee(code, message, details) {
  throw new RefereeOperationsError(code, message, details);
}

/**
 * @param {unknown} err
 * @param {string} [fallbackCode]
 * @param {string} [fallbackMessage]
 * @returns {RefereeOperationsError}
 */
export function normalizeRefereeError(
  err,
  fallbackCode = REFEREE_ERROR_CODE.UNKNOWN,
  fallbackMessage = "Referee operations failed"
) {
  if (isRefereeOperationsError(err)) {
    return /** @type {RefereeOperationsError} */ (err);
  }
  if (
    err &&
    typeof err === "object" &&
    typeof /** @type {{ code?: unknown }} */ (err).code === "string"
  ) {
    const code = String(/** @type {{ code: string }} */ (err).code);
    const message =
      err instanceof Error
        ? err.message
        : typeof /** @type {{ message?: unknown }} */ (err).message === "string"
          ? /** @type {{ message: string }} */ (err).message
          : fallbackMessage;
    return new RefereeOperationsError(code, message, {
      causeName: err instanceof Error ? err.name : "unknown",
    });
  }
  return new RefereeOperationsError(
    fallbackCode,
    err instanceof Error ? err.message : fallbackMessage,
    { causeName: err instanceof Error ? err.name : typeof err }
  );
}
