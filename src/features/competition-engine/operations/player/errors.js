/**
 * E2E-04 Player Operations typed errors — fail-closed.
 */

import { PLAYER_ERROR_CODE, PLAYER_ERROR_CODE_VALUES } from "./constants.js";

export class PlayerOperationsError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PlayerOperationsError";
    this.code =
      typeof code === "string" && code.trim()
        ? code.trim()
        : PLAYER_ERROR_CODE.UNKNOWN;
    this.failClosed = true;
    this.details = Object.freeze({ ...details });
  }
}

/**
 * @param {unknown} err
 * @returns {err is PlayerOperationsError}
 */
export function isPlayerOperationsError(err) {
  return (
    err instanceof PlayerOperationsError ||
    (Boolean(err) &&
      typeof err === "object" &&
      /** @type {{ name?: unknown }} */ (err).name === "PlayerOperationsError" &&
      typeof /** @type {{ code?: unknown }} */ (err).code === "string")
  );
}

/**
 * @param {unknown} code
 * @returns {boolean}
 */
export function isPlayerErrorCode(code) {
  return PLAYER_ERROR_CODE_VALUES.includes(String(code || ""));
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failPlayer(code, message, details) {
  throw new PlayerOperationsError(code, message, details);
}

/**
 * @param {unknown} err
 * @param {string} [fallbackCode]
 * @param {string} [fallbackMessage]
 * @returns {PlayerOperationsError}
 */
export function normalizePlayerError(
  err,
  fallbackCode = PLAYER_ERROR_CODE.UNKNOWN,
  fallbackMessage = "Player operations failed"
) {
  if (isPlayerOperationsError(err)) {
    return /** @type {PlayerOperationsError} */ (err);
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
    return new PlayerOperationsError(code, message, {
      causeName: err instanceof Error ? err.name : "unknown",
    });
  }
  return new PlayerOperationsError(
    fallbackCode,
    err instanceof Error ? err.message : fallbackMessage,
    { causeName: err instanceof Error ? err.name : typeof err }
  );
}
