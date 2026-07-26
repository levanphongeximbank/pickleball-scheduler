/**
 * Write-facade typed failures (BM-FINAL-RATING-01).
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { PlayerRatingFoundationError } from "../errors/PlayerRatingFoundationError.js";

export const PLAYER_RATING_WRITE_FACADE_PHASE = Object.freeze({
  id: "BM-FINAL-RATING-01",
  name: "canonical-write-facade",
  wiredToProductionRuntime: false,
  durableAuthority: "pick-vn-rating-v5-service-rpc",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failWriteFacade(code, message, details = {}) {
  throw new PlayerRatingFoundationError(code, message, details);
}

/**
 * @param {string} operation
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failDurableRuntimeUnavailable(operation, details = {}) {
  return failWriteFacade(
    PLAYER_RATING_FOUNDATION_ERROR_CODE.DURABLE_RUNTIME_UNAVAILABLE,
    `Player Rating durable runtime unavailable for ${operation}`,
    { operation, ...details }
  );
}

/**
 * @param {string} operation
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failWriterFrozen(operation, details = {}) {
  return failWriteFacade(
    PLAYER_RATING_FOUNDATION_ERROR_CODE.WRITER_FROZEN,
    `Player Rating competing writer frozen: ${operation}`,
    { operation, ...details }
  );
}
