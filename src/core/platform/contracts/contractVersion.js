/**
 * Contract Version contract (Platform Core Phase 1F–1J).
 *
 * Open string representation of a contract version. Does not require semantic
 * versioning, parse/compare versions, auto-upgrade, or maintain a registry.
 */

import { fail, ok } from "./result.js";

/** @typedef {string} ContractVersion */

export const CONTRACT_VERSION_ERROR = Object.freeze({
  NOT_STRING: "CONTRACT_VERSION_NOT_STRING",
  EMPTY: "CONTRACT_VERSION_EMPTY",
});

/**
 * @param {string} code
 * @param {string} message
 * @returns {{ code: string, message: string }}
 */
function contractVersionError(code, message) {
  return Object.freeze({ code, message });
}

/**
 * Create a normalized Contract Version from an externally provided string.
 *
 * @param {*} value
 * @returns {import("./result.js").Result}
 */
export function createContractVersion(value) {
  if (typeof value !== "string") {
    return fail(
      contractVersionError(
        CONTRACT_VERSION_ERROR.NOT_STRING,
        "ContractVersion must be a string"
      )
    );
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return fail(
      contractVersionError(
        CONTRACT_VERSION_ERROR.EMPTY,
        "ContractVersion must be a non-empty string"
      )
    );
  }

  return ok(/** @type {ContractVersion} */ (normalized));
}

/**
 * @param {*} value
 * @returns {value is ContractVersion}
 */
export function isContractVersion(value) {
  return createContractVersion(value).ok === true;
}
