/**
 * Integration domain errors — fail-closed, normalized for adapter consumers.
 */

import {
  INTEGRATION_ERROR_CODE,
  INTEGRATION_ERROR_CODE_VALUES,
} from "./constants.js";

export class IntegrationError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ details?: Record<string, unknown>, failClosed?: boolean, cause?: unknown }} [options]
   */
  constructor(code, message, options = {}) {
    super(message);
    this.name = "IntegrationError";
    this.code = String(code || INTEGRATION_ERROR_CODE.ADAPTER_FAILURE);
    this.failClosed = options.failClosed !== false;
    this.details =
      options.details && typeof options.details === "object"
        ? { ...options.details }
        : {};
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isIntegrationError(value) {
  return (
    value instanceof IntegrationError ||
    (Boolean(value) &&
      typeof value === "object" &&
      /** @type {{ name?: unknown }} */ (value).name === "IntegrationError" &&
      typeof /** @type {{ code?: unknown }} */ (value).code === "string")
  );
}

/**
 * @param {unknown} code
 * @returns {boolean}
 */
export function isIntegrationErrorCode(code) {
  return INTEGRATION_ERROR_CODE_VALUES.includes(String(code || ""));
}

/**
 * @param {string} code
 * @param {string} message
 * @param {{ details?: Record<string, unknown>, failClosed?: boolean, cause?: unknown }} [options]
 * @returns {never}
 */
export function throwIntegrationError(code, message, options = {}) {
  throw new IntegrationError(code, message, options);
}

/**
 * Normalize unknown adapter failures into IntegrationError without leaking internals.
 * @param {unknown} err
 * @param {string} [fallbackCode]
 * @param {string} [fallbackMessage]
 * @returns {IntegrationError}
 */
export function normalizeAdapterError(
  err,
  fallbackCode = INTEGRATION_ERROR_CODE.ADAPTER_FAILURE,
  fallbackMessage = "Integration adapter failed"
) {
  if (isIntegrationError(err)) {
    return /** @type {IntegrationError} */ (err);
  }
  if (err && typeof err === "object" && typeof /** @type {{ code?: unknown }} */ (err).code === "string") {
    const code = String(/** @type {{ code: string }} */ (err).code);
    const message =
      err instanceof Error
        ? err.message
        : typeof /** @type {{ message?: unknown }} */ (err).message === "string"
          ? /** @type {{ message: string }} */ (err).message
          : fallbackMessage;
    return new IntegrationError(code, message, {
      failClosed: true,
      details: {
        normalizedFrom: err instanceof Error ? err.name : typeof err,
      },
      cause: err,
    });
  }
  return new IntegrationError(fallbackCode, fallbackMessage, {
    failClosed: true,
    details: {
      message: err instanceof Error ? err.message : String(err ?? "unknown"),
    },
    cause: err,
  });
}
