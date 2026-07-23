/**
 * Player Rating Foundation — typed contract / port error (Phase 1B).
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "./errorCodes.js";

export class PlayerRatingFoundationError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "PlayerRatingFoundationError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" ? { ...details } : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is PlayerRatingFoundationError}
 */
export function isPlayerRatingFoundationError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name === "PlayerRatingFoundationError"
  );
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isPlayerRatingFoundationErrorCode(code) {
  return Object.values(PLAYER_RATING_FOUNDATION_ERROR_CODE).includes(
    String(code)
  );
}
