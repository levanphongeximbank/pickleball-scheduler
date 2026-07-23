/**
 * Role Code contract (Platform Core Phase 1F–1J).
 *
 * Open string representation of a role code. Does not import Identity or
 * Business Module roles, evaluate hierarchy, or assign roles.
 */

import { fail, ok } from "./result.js";

/** @typedef {string} RoleCode */

export const ROLE_CODE_ERROR = Object.freeze({
  NOT_STRING: "ROLE_CODE_NOT_STRING",
  EMPTY: "ROLE_CODE_EMPTY",
});

/**
 * @param {string} code
 * @param {string} message
 * @returns {{ code: string, message: string }}
 */
function roleCodeError(code, message) {
  return Object.freeze({ code, message });
}

/**
 * Create a normalized Role Code from an externally provided string.
 *
 * @param {*} value
 * @returns {import("./result.js").Result}
 */
export function createRoleCode(value) {
  if (typeof value !== "string") {
    return fail(
      roleCodeError(ROLE_CODE_ERROR.NOT_STRING, "RoleCode must be a string")
    );
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return fail(
      roleCodeError(
        ROLE_CODE_ERROR.EMPTY,
        "RoleCode must be a non-empty string"
      )
    );
  }

  return ok(/** @type {RoleCode} */ (normalized));
}

/**
 * @param {*} value
 * @returns {value is RoleCode}
 */
export function isRoleCode(value) {
  return createRoleCode(value).ok === true;
}
