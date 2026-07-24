/**
 * Idempotency Key Adapter — projects a caller-supplied idempotency key into
 * Platform Core IdempotencyKey.
 *
 * Does not generate, hash, look up headers, persist, lock, expire, detect
 * duplicates, or access environment / storage / database.
 */

import { fail } from "../../contracts/result.js";
import { createIdempotencyKey } from "../../contracts/idempotencyKey.js";

export const IDEMPOTENCY_KEY_ADAPTER_ERROR = Object.freeze({
  INVALID: "IDEMPOTENCY_KEY_ADAPTER_INVALID",
  KEY_REQUIRED: "IDEMPOTENCY_KEY_ADAPTER_KEY_REQUIRED",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function adapterError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * Project an externally supplied idempotency key string.
 *
 * Accepts a bare string, or `{ idempotencyKey }` / `{ key }` object wrappers.
 * Canonical trimming is performed only by createIdempotencyKey.
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectIdempotencyKey(input) {
  if (typeof input === "string") {
    return createIdempotencyKey(input);
  }

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      adapterError(
        IDEMPOTENCY_KEY_ADAPTER_ERROR.INVALID,
        "Idempotency key input must be a string or plain object"
      )
    );
  }

  const value =
    "idempotencyKey" in input && input.idempotencyKey !== undefined
      ? input.idempotencyKey
      : input.key;

  if (value === undefined || value === null) {
    return fail(
      adapterError(
        IDEMPOTENCY_KEY_ADAPTER_ERROR.KEY_REQUIRED,
        "Idempotency key projection requires an explicit idempotency key",
        "idempotencyKey"
      )
    );
  }

  return createIdempotencyKey(value);
}
