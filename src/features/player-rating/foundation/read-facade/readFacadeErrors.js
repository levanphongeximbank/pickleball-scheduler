/**
 * Phase 1H read-facade typed errors.
 * Reuses PlayerRatingFoundationError and existing stable codes.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { PlayerRatingFoundationError } from "../errors/PlayerRatingFoundationError.js";
import {
  PLAYER_RATING_READ_MODEL_ERROR_CODE,
  PLAYER_RATING_READ_MODEL_REUSED_ERROR_CODE,
} from "../read-model/ratingReadModelErrors.js";

/** Codes commonly reused by the read facade (no new codes required). */
export const PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE = Object.freeze({
  INVALID_RATING_CONTRACT:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
  TENANT_OR_SCOPE_UNRESOLVED:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED,
  CANONICAL_PLAYER_ID_UNRESOLVED:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
  UNSUPPORTED_RATING_MODE:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.UNSUPPORTED_RATING_MODE,
  PORT_OPERATION_UNIMPLEMENTED:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
  HISTORY_ENTRY_NOT_FOUND:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.HISTORY_ENTRY_NOT_FOUND,
  SNAPSHOT_NOT_FOUND: PLAYER_RATING_FOUNDATION_ERROR_CODE.SNAPSHOT_NOT_FOUND,
  CANONICAL_PLAYER_ID_CONFLICT:
    PLAYER_RATING_READ_MODEL_ERROR_CODE.CANONICAL_PLAYER_ID_CONFLICT,
  INVALID_SOURCE_RECORD:
    PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
});

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failReadFacade(code, message, details = {}) {
  throw new PlayerRatingFoundationError(code, message, details);
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isPlayerRatingReadFacadeErrorCode(code) {
  return (
    Object.values(PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE).includes(
      String(code)
    ) ||
    Object.values(PLAYER_RATING_READ_MODEL_REUSED_ERROR_CODE).includes(
      String(code)
    ) ||
    Object.values(PLAYER_RATING_READ_MODEL_ERROR_CODE).includes(String(code))
  );
}
