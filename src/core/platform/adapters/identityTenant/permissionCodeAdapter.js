/**
 * Permission Code Adapter — projects an existing permission string into
 * Platform Core PermissionCode.
 *
 * Does not rewrite registries, convert case, or map actions to permissions.
 */

import { fail } from "../../contracts/result.js";
import { createPermissionCode } from "../../contracts/permissionCode.js";

export const PERMISSION_CODE_ADAPTER_ERROR = Object.freeze({
  INVALID: "PERMISSION_CODE_ADAPTER_INVALID",
  CODE_REQUIRED: "PERMISSION_CODE_ADAPTER_CODE_REQUIRED",
});

/**
 * @param {string} code
 * @param {string} message
 * @returns {{ code: string, message: string }}
 */
function adapterError(code, message) {
  return Object.freeze({ code, message });
}

/**
 * Project an externally supplied permission string.
 *
 * Accepts a bare string, or `{ permissionCode }` / `{ permission }` /
 * `{ code }` object wrappers without transforming separators or case.
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectPermissionCode(input) {
  if (typeof input === "string") {
    return createPermissionCode(input);
  }

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      adapterError(
        PERMISSION_CODE_ADAPTER_ERROR.INVALID,
        "Permission code input must be a string or plain object"
      )
    );
  }

  const value =
    "permissionCode" in input && input.permissionCode !== undefined
      ? input.permissionCode
      : "permission" in input && input.permission !== undefined
        ? input.permission
        : input.code;

  if (value === undefined || value === null) {
    return fail(
      adapterError(
        PERMISSION_CODE_ADAPTER_ERROR.CODE_REQUIRED,
        "Permission code projection requires an explicit permission string"
      )
    );
  }

  return createPermissionCode(value);
}
