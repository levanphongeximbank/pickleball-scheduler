/**
 * Phase 1C read-model typed errors.
 * Reuses PlayerRatingFoundationError; adds narrow read-model codes only.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { PlayerRatingFoundationError } from "../errors/PlayerRatingFoundationError.js";

export const PLAYER_RATING_READ_MODEL_ERROR_CODE = Object.freeze({
  UNSUPPORTED_SOURCE_TYPE: "PLAYER_RATING_UNSUPPORTED_SOURCE_TYPE",
  INVALID_SOURCE_RECORD: "PLAYER_RATING_INVALID_SOURCE_RECORD",
  AMBIGUOUS_SOURCE_SCALE: "PLAYER_RATING_AMBIGUOUS_SOURCE_SCALE",
  CANONICAL_PLAYER_ID_CONFLICT: "PLAYER_RATING_CANONICAL_PLAYER_ID_CONFLICT",
  CANDIDATE_IDENTITY_COLLISION: "PLAYER_RATING_CANDIDATE_IDENTITY_COLLISION",
  ALIAS_TREATED_AS_CANONICAL: "PLAYER_RATING_ALIAS_TREATED_AS_CANONICAL",
});

/** Re-export Phase 1B codes commonly reused by the read model. */
export const PLAYER_RATING_READ_MODEL_REUSED_ERROR_CODE = Object.freeze({
  INVALID_RATING_CONTRACT:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
  TENANT_OR_SCOPE_UNRESOLVED:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED,
  CANONICAL_PLAYER_ID_UNRESOLVED:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
  UNSUPPORTED_RATING_MODE:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.UNSUPPORTED_RATING_MODE,
});

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failReadModel(code, message, details = {}) {
  throw new PlayerRatingFoundationError(code, message, details);
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isPlayerRatingReadModelErrorCode(code) {
  return (
    Object.values(PLAYER_RATING_READ_MODEL_ERROR_CODE).includes(String(code)) ||
    Object.values(PLAYER_RATING_READ_MODEL_REUSED_ERROR_CODE).includes(
      String(code)
    )
  );
}
