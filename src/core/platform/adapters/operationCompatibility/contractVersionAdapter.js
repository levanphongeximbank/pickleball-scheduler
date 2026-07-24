/**
 * Contract Version Adapter — projects a caller-supplied version string into
 * Platform Core ContractVersion.
 *
 * Versions remain opaque. Does not parse semver, compare, normalize beyond
 * canonical trimming, default, look up a registry, or migrate.
 */

import { fail } from "../../contracts/result.js";
import { createContractVersion } from "../../contracts/contractVersion.js";

export const CONTRACT_VERSION_ADAPTER_ERROR = Object.freeze({
  INVALID: "CONTRACT_VERSION_ADAPTER_INVALID",
  VERSION_REQUIRED: "CONTRACT_VERSION_ADAPTER_VERSION_REQUIRED",
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
 * Project an externally supplied contract version string.
 *
 * Accepts a bare string, or `{ version }` / `{ contractVersion }` wrappers.
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectContractVersion(input) {
  if (typeof input === "string") {
    return createContractVersion(input);
  }

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      adapterError(
        CONTRACT_VERSION_ADAPTER_ERROR.INVALID,
        "Contract version input must be a string or plain object"
      )
    );
  }

  const value =
    "contractVersion" in input && input.contractVersion !== undefined
      ? input.contractVersion
      : input.version;

  if (value === undefined || value === null) {
    return fail(
      adapterError(
        CONTRACT_VERSION_ADAPTER_ERROR.VERSION_REQUIRED,
        "Contract version projection requires an explicit version string",
        "version"
      )
    );
  }

  return createContractVersion(value);
}
