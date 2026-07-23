/**
 * Shared helpers for Player Rating Foundation ports (Phase 1B).
 * Ports fail clearly when operations are unimplemented.
 * No Supabase. No Competition Engine runtime. No Ranking / Player Management writes.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { PlayerRatingFoundationError } from "../errors/PlayerRatingFoundationError.js";

/**
 * @param {string} portName
 * @param {string} operation
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function throwPortUnimplemented(portName, operation, details = {}) {
  throw new PlayerRatingFoundationError(
    PLAYER_RATING_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
    `${portName}.${operation} is unimplemented in Player Rating Foundation Phase 1B`,
    { portName, operation, ...details }
  );
}

/**
 * @param {unknown} port
 * @param {readonly string[]} methodNames
 * @returns {boolean}
 */
export function matchesPortMethods(port, methodNames) {
  if (!port || typeof port !== "object") return false;
  return methodNames.every(
    (name) => typeof /** @type {Record<string, unknown>} */ (port)[name] === "function"
  );
}
