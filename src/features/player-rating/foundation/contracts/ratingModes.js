/**
 * Supported Player Rating modes (Phase 1A freeze / Phase 1B skeleton).
 * Mixed doubles and team remain open gates — not supported here.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { failContract } from "./shared.js";

export const PLAYER_RATING_SUPPORTED_MODES = Object.freeze([
  "overall",
  "singles",
  "doubles",
]);

/**
 * @param {unknown} mode
 * @returns {mode is 'overall'|'singles'|'doubles'}
 */
export function isSupportedRatingMode(mode) {
  return PLAYER_RATING_SUPPORTED_MODES.includes(/** @type {string} */ (mode));
}

/**
 * @param {unknown} mode
 * @returns {'overall'|'singles'|'doubles'}
 */
export function requireSupportedRatingMode(mode) {
  if (!isSupportedRatingMode(mode)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.UNSUPPORTED_RATING_MODE,
      `Unsupported ratingMode: ${String(mode)}`,
      { ratingMode: mode, supported: [...PLAYER_RATING_SUPPORTED_MODES] }
    );
  }
  return /** @type {'overall'|'singles'|'doubles'} */ (mode);
}
