/**
 * Typed error helpers for Phase 1I security / privacy (reuse foundation error).
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { PlayerRatingFoundationError } from "../errors/PlayerRatingFoundationError.js";

/**
 * Safe details only — never attach restricted raw rating/privacy payloads.
 * @param {unknown} details
 * @returns {Record<string, unknown>}
 */
export function sanitizeSecurityErrorDetails(details) {
  if (!details || typeof details !== "object") return {};
  const raw = /** @type {Record<string, unknown>} */ (details);
  /** @type {Record<string, unknown>} */
  const out = {};
  const allow = [
    "field",
    "projectionLevel",
    "requiredCapability",
    "actorId",
    "subjectPlayerId",
    "mappedSubjectPlayerId",
    "scopeKind",
    "reasonCode",
  ];
  for (const key of allow) {
    if (key in raw && raw[key] != null) {
      const value = raw[key];
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        out[key] = value;
      }
    }
  }
  return out;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failSecurityPrivacy(code, message, details) {
  throw new PlayerRatingFoundationError(
    code,
    message,
    sanitizeSecurityErrorDetails(details)
  );
}

export const PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE = Object.freeze({
  RATING_READ_UNAUTHORIZED:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_READ_UNAUTHORIZED,
  RATING_PROJECTION_LEVEL_UNSUPPORTED:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_PROJECTION_LEVEL_UNSUPPORTED,
  RATING_SUBJECT_MISMATCH:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_SUBJECT_MISMATCH,
  RATING_TENANT_ACCESS_DENIED:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_TENANT_ACCESS_DENIED,
  RATING_GLOBAL_SCOPE_DENIED:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_GLOBAL_SCOPE_DENIED,
  RATING_PRIVATE_FIELD_EXPOSURE_BLOCKED:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_PRIVATE_FIELD_EXPOSURE_BLOCKED,
  TENANT_OR_SCOPE_UNRESOLVED:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED,
  INVALID_RATING_CONTRACT:
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
});
