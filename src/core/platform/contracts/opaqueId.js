/**
 * Generic OpaqueId validation and normalization (Platform Core Phase 1B).
 *
 * Accepts any non-empty trimmed string (UUID, prefixed, or ordinary opaque).
 * Does not generate identifiers and does not claim business-ID ownership.
 */

import { fail, ok } from "./result.js";

/** @typedef {string} OpaqueId */

export const OPAQUE_ID_ERROR = Object.freeze({
  NOT_STRING: "OPAQUE_ID_NOT_STRING",
  EMPTY: "OPAQUE_ID_EMPTY",
});

/**
 * @param {string} code
 * @param {string} message
 * @returns {{ code: string, message: string }}
 */
function opaqueIdError(code, message) {
  return Object.freeze({ code, message });
}

/**
 * Normalize an opaque identifier string.
 *
 * @param {*} value
 * @returns {import("./result.js").Result}
 */
export function normalizeOpaqueId(value) {
  if (typeof value !== "string") {
    return fail(
      opaqueIdError(
        OPAQUE_ID_ERROR.NOT_STRING,
        "OpaqueId must be a string"
      )
    );
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return fail(
      opaqueIdError(
        OPAQUE_ID_ERROR.EMPTY,
        "OpaqueId must be a non-empty string"
      )
    );
  }

  return ok(/** @type {OpaqueId} */ (normalized));
}

/**
 * @param {*} value
 * @returns {value is OpaqueId}
 */
export function isOpaqueId(value) {
  return normalizeOpaqueId(value).ok === true;
}
