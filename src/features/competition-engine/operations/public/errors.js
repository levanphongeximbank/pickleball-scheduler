/**
 * E2E-05 typed errors — fail-closed public reads, no silent fallback.
 */

import { PUBLIC_ERROR_CODE, PUBLIC_ERROR_CODE_VALUES } from "./constants.js";

export class PublicCompetitionExperienceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PublicCompetitionExperienceError";
    this.code =
      typeof code === "string" && code.trim()
        ? code.trim()
        : PUBLIC_ERROR_CODE.UNKNOWN;
    this.failClosed = true;
    this.details = Object.freeze({ ...details });
  }
}

/**
 * @param {unknown} err
 * @returns {err is PublicCompetitionExperienceError}
 */
export function isPublicCompetitionExperienceError(err) {
  return (
    err instanceof PublicCompetitionExperienceError ||
    (Boolean(err) &&
      typeof err === "object" &&
      /** @type {{ name?: unknown }} */ (err).name ===
        "PublicCompetitionExperienceError" &&
      typeof /** @type {{ code?: unknown }} */ (err).code === "string")
  );
}

/**
 * @param {unknown} code
 * @returns {boolean}
 */
export function isPublicErrorCode(code) {
  return PUBLIC_ERROR_CODE_VALUES.includes(String(code || ""));
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failPublic(code, message, details) {
  throw new PublicCompetitionExperienceError(code, message, details);
}

/**
 * @param {unknown} err
 * @param {string} [fallbackCode]
 * @param {string} [fallbackMessage]
 * @returns {PublicCompetitionExperienceError}
 */
export function normalizePublicError(
  err,
  fallbackCode = PUBLIC_ERROR_CODE.UNKNOWN,
  fallbackMessage = "Public competition experience failed"
) {
  if (isPublicCompetitionExperienceError(err)) {
    return /** @type {PublicCompetitionExperienceError} */ (err);
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
    return new PublicCompetitionExperienceError(code, message, {
      normalizedFrom: err instanceof Error ? err.name : typeof err,
    });
  }
  return new PublicCompetitionExperienceError(fallbackCode, fallbackMessage, {
    message: err instanceof Error ? err.message : String(err ?? "unknown"),
  });
}
