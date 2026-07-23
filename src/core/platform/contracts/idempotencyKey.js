/**
 * Idempotency Key contract (Platform Core Phase 1F–1J).
 *
 * Open string representation of an idempotency key. Accepts UUID, prefixed,
 * or opaque keys. Does not generate, hash, persist, or deduplicate.
 */

import { fail, ok } from "./result.js";

/** @typedef {string} IdempotencyKey */

export const IDEMPOTENCY_KEY_ERROR = Object.freeze({
  NOT_STRING: "IDEMPOTENCY_KEY_NOT_STRING",
  EMPTY: "IDEMPOTENCY_KEY_EMPTY",
});

/**
 * @param {string} code
 * @param {string} message
 * @returns {{ code: string, message: string }}
 */
function idempotencyKeyError(code, message) {
  return Object.freeze({ code, message });
}

/**
 * Create a normalized Idempotency Key from an externally provided string.
 *
 * @param {*} value
 * @returns {import("./result.js").Result}
 */
export function createIdempotencyKey(value) {
  if (typeof value !== "string") {
    return fail(
      idempotencyKeyError(
        IDEMPOTENCY_KEY_ERROR.NOT_STRING,
        "IdempotencyKey must be a string"
      )
    );
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return fail(
      idempotencyKeyError(
        IDEMPOTENCY_KEY_ERROR.EMPTY,
        "IdempotencyKey must be a non-empty string"
      )
    );
  }

  return ok(/** @type {IdempotencyKey} */ (normalized));
}

/**
 * @param {*} value
 * @returns {value is IdempotencyKey}
 */
export function isIdempotencyKey(value) {
  return createIdempotencyKey(value).ok === true;
}
