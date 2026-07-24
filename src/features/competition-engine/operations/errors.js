/**
 * E2E-03 typed errors — fail-closed, no silent fallback.
 */

import { ORGANIZER_ERROR_CODE, ORGANIZER_ERROR_CODE_VALUES } from "./constants.js";

export class OrganizerOperationsError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "OrganizerOperationsError";
    this.code =
      typeof code === "string" && code.trim()
        ? code.trim()
        : ORGANIZER_ERROR_CODE.UNKNOWN;
    this.failClosed = true;
    this.details = Object.freeze({ ...details });
  }
}

/**
 * @param {unknown} err
 * @returns {err is OrganizerOperationsError}
 */
export function isOrganizerOperationsError(err) {
  return (
    err instanceof OrganizerOperationsError ||
    (Boolean(err) &&
      typeof err === "object" &&
      /** @type {{ name?: unknown }} */ (err).name === "OrganizerOperationsError" &&
      typeof /** @type {{ code?: unknown }} */ (err).code === "string")
  );
}

/**
 * @param {unknown} code
 * @returns {boolean}
 */
export function isOrganizerErrorCode(code) {
  return ORGANIZER_ERROR_CODE_VALUES.includes(String(code || ""));
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failOrganizer(code, message, details) {
  throw new OrganizerOperationsError(code, message, details);
}

/**
 * Normalize unknown failures into OrganizerOperationsError.
 * @param {unknown} err
 * @param {string} [fallbackCode]
 * @param {string} [fallbackMessage]
 * @returns {OrganizerOperationsError}
 */
export function normalizeOrganizerError(
  err,
  fallbackCode = ORGANIZER_ERROR_CODE.UNKNOWN,
  fallbackMessage = "Organizer operations failed"
) {
  if (isOrganizerOperationsError(err)) {
    return /** @type {OrganizerOperationsError} */ (err);
  }
  if (err && typeof err === "object" && typeof /** @type {{ code?: unknown }} */ (err).code === "string") {
    const code = String(/** @type {{ code: string }} */ (err).code);
    const message =
      err instanceof Error
        ? err.message
        : typeof /** @type {{ message?: unknown }} */ (err).message === "string"
          ? /** @type {{ message: string }} */ (err).message
          : fallbackMessage;
    return new OrganizerOperationsError(code, message, {
      normalizedFrom: err instanceof Error ? err.name : typeof err,
    });
  }
  return new OrganizerOperationsError(fallbackCode, fallbackMessage, {
    message: err instanceof Error ? err.message : String(err ?? "unknown"),
  });
}
