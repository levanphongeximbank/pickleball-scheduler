/**
 * Shared validation helpers for Player Rating Foundation contracts (Phase 1B).
 * No rating formula, Elo math, or conversion logic.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { PlayerRatingFoundationError } from "../errors/PlayerRatingFoundationError.js";

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failContract(code, message, details) {
  throw new PlayerRatingFoundationError(code, message, details);
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidTimestamp(value) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value !== "string" || !value.trim()) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireNonEmptyString(value, field) {
  if (!isNonEmptyString(value)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      `Missing or invalid required field: ${field}`,
      { field }
    );
  }
  return String(value).trim();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string|number}
 */
export function requireValidTimestamp(value, field) {
  if (!isValidTimestamp(value)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      `Missing or invalid timestamp: ${field}`,
      { field, value }
    );
  }
  return /** @type {string|number} */ (value);
}

/**
 * Deep-freeze a plain JSON-safe object graph (arrays/objects only).
 * @template T
 * @param {T} value
 * @returns {Readonly<T>}
 */
export function deepFreeze(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  for (const key of Reflect.ownKeys(value)) {
    const child = /** @type {Record<string|symbol, unknown>} */ (value)[key];
    if (child && typeof child === "object") {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}

/**
 * Shallow JSON-safe clone for contract construction.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function clonePlain(value) {
  return /** @type {T} */ (JSON.parse(JSON.stringify(value)));
}
