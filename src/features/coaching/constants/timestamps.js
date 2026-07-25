import { COACHING_ERROR_CODES } from "./errorCodes.js";
import { CoachingError } from "../errors/CoachingError.js";

export const COACHING_TIMESTAMP_FORMAT = "ISO-8601";

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isIsoTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString() === new Date(value).toISOString()
    ? true
    : Number.isFinite(ms);
}

/**
 * Normalize an explicit ISO timestamp. Does not call wall-clock APIs.
 *
 * @param {unknown} value
 * @param {string} [field]
 * @returns {string}
 */
export function requireIsoTimestamp(value, field = "timestamp") {
  if (typeof value !== "string" || !value.trim()) {
    throw new CoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      `${field} must be an explicit ISO-8601 timestamp (inject clock).`,
      { field }
    );
  }
  const trimmed = value.trim();
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) {
    throw new CoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      `${field} must be a valid ISO-8601 timestamp.`,
      { field, value: trimmed }
    );
  }
  return new Date(ms).toISOString();
}

/**
 * @param {unknown} value
 * @param {string} [field]
 * @returns {string|null}
 */
export function optionalIsoTimestamp(value, field = "timestamp") {
  if (value == null || value === "") return null;
  return requireIsoTimestamp(value, field);
}
