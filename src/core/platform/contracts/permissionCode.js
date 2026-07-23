/**
 * Permission Code contract (Platform Core Phase 1F–1J).
 *
 * Open string representation of a permission code. Does not import a
 * permission registry, map actions, or check whether a permission exists.
 */

import { fail, ok } from "./result.js";

/** @typedef {string} PermissionCode */

export const PERMISSION_CODE_ERROR = Object.freeze({
  NOT_STRING: "PERMISSION_CODE_NOT_STRING",
  EMPTY: "PERMISSION_CODE_EMPTY",
});

/**
 * @param {string} code
 * @param {string} message
 * @returns {{ code: string, message: string }}
 */
function permissionCodeError(code, message) {
  return Object.freeze({ code, message });
}

/**
 * Create a normalized Permission Code from an externally provided string.
 *
 * @param {*} value
 * @returns {import("./result.js").Result}
 */
export function createPermissionCode(value) {
  if (typeof value !== "string") {
    return fail(
      permissionCodeError(
        PERMISSION_CODE_ERROR.NOT_STRING,
        "PermissionCode must be a string"
      )
    );
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return fail(
      permissionCodeError(
        PERMISSION_CODE_ERROR.EMPTY,
        "PermissionCode must be a non-empty string"
      )
    );
  }

  return ok(/** @type {PermissionCode} */ (normalized));
}

/**
 * @param {*} value
 * @returns {value is PermissionCode}
 */
export function isPermissionCode(value) {
  return createPermissionCode(value).ok === true;
}
