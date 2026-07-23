/**
 * Platform Capability Descriptor contract (Platform Core Phase 1F–1J).
 *
 * Descriptive representation of a platform capability for later discovery.
 * Does not maintain a mutable registry, auto-discover modules, load
 * features, or rewrite Business Module ownership.
 */

import { fail, ok } from "./result.js";
import { createContractVersion } from "./contractVersion.js";

/**
 * @typedef {{
 *   capabilityCode: string,
 *   ownerModule: string,
 *   version?: string,
 *   status?: string,
 * }} PlatformCapabilityDescriptor
 */

export const PLATFORM_CAPABILITY_DESCRIPTOR_ERROR = Object.freeze({
  INVALID: "PLATFORM_CAPABILITY_DESCRIPTOR_INVALID",
  CAPABILITY_CODE_INVALID:
    "PLATFORM_CAPABILITY_DESCRIPTOR_CAPABILITY_CODE_INVALID",
  OWNER_MODULE_INVALID: "PLATFORM_CAPABILITY_DESCRIPTOR_OWNER_MODULE_INVALID",
  VERSION_INVALID: "PLATFORM_CAPABILITY_DESCRIPTOR_VERSION_INVALID",
  STATUS_INVALID: "PLATFORM_CAPABILITY_DESCRIPTOR_STATUS_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function platformCapabilityDescriptorError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * @param {*} input
 * @param {string} field
 * @param {string} errorCode
 * @param {string} label
 * @returns {import("./result.js").Result}
 */
function requireTrimmedString(input, field, errorCode, label) {
  if (typeof input[field] !== "string") {
    return fail(
      platformCapabilityDescriptorError(
        errorCode,
        `PlatformCapabilityDescriptor ${label} must be a string`,
        field
      )
    );
  }

  const normalized = input[field].trim();
  if (normalized.length === 0) {
    return fail(
      platformCapabilityDescriptorError(
        errorCode,
        `PlatformCapabilityDescriptor ${label} must be a non-empty string`,
        field
      )
    );
  }

  return ok(normalized);
}

/**
 * @param {*} input
 * @returns {import("./result.js").Result}
 */
export function createPlatformCapabilityDescriptor(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      platformCapabilityDescriptorError(
        PLATFORM_CAPABILITY_DESCRIPTOR_ERROR.INVALID,
        "PlatformCapabilityDescriptor input must be a plain object"
      )
    );
  }

  const capabilityCodeResult = requireTrimmedString(
    input,
    "capabilityCode",
    PLATFORM_CAPABILITY_DESCRIPTOR_ERROR.CAPABILITY_CODE_INVALID,
    "capabilityCode"
  );
  if (!capabilityCodeResult.ok) return capabilityCodeResult;

  const ownerModuleResult = requireTrimmedString(
    input,
    "ownerModule",
    PLATFORM_CAPABILITY_DESCRIPTOR_ERROR.OWNER_MODULE_INVALID,
    "ownerModule"
  );
  if (!ownerModuleResult.ok) return ownerModuleResult;

  /** @type {PlatformCapabilityDescriptor} */
  const descriptor = {
    capabilityCode: capabilityCodeResult.value,
    ownerModule: ownerModuleResult.value,
  };

  if ("version" in input && input.version !== undefined) {
    const versionResult = createContractVersion(input.version);
    if (!versionResult.ok) {
      return fail(
        platformCapabilityDescriptorError(
          PLATFORM_CAPABILITY_DESCRIPTOR_ERROR.VERSION_INVALID,
          "PlatformCapabilityDescriptor version must be a valid ContractVersion",
          "version"
        )
      );
    }
    descriptor.version = versionResult.value;
  }

  if ("status" in input && input.status !== undefined) {
    if (typeof input.status !== "string") {
      return fail(
        platformCapabilityDescriptorError(
          PLATFORM_CAPABILITY_DESCRIPTOR_ERROR.STATUS_INVALID,
          "PlatformCapabilityDescriptor status must be a string",
          "status"
        )
      );
    }

    const status = input.status.trim();
    if (status.length === 0) {
      return fail(
        platformCapabilityDescriptorError(
          PLATFORM_CAPABILITY_DESCRIPTOR_ERROR.STATUS_INVALID,
          "PlatformCapabilityDescriptor status must be a non-empty string",
          "status"
        )
      );
    }
    descriptor.status = status;
  }

  return ok(Object.freeze(descriptor));
}

/**
 * @param {*} value
 * @returns {value is PlatformCapabilityDescriptor}
 */
export function isPlatformCapabilityDescriptor(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (
    typeof value.capabilityCode !== "string" ||
    typeof value.ownerModule !== "string"
  ) {
    return false;
  }
  return createPlatformCapabilityDescriptor(value).ok === true;
}
