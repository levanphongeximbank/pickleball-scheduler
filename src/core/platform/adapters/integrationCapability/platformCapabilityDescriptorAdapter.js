/**
 * Platform Capability Descriptor Adapter — projects caller-supplied capability
 * descriptor fields into Platform Core PlatformCapabilityDescriptor.
 *
 * Does not execute capabilities, load modules, infer status or production
 * readiness, check tenant availability, access databases / environment /
 * feature flags, mutate registries, or auto-discover capabilities.
 */

import { fail } from "../../contracts/result.js";
import { createPlatformCapabilityDescriptor } from "../../contracts/platformCapabilityDescriptor.js";
import { projectContractVersion } from "../operationCompatibility/contractVersionAdapter.js";

export const PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER_ERROR = Object.freeze({
  INVALID: "PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER_INVALID",
  CAPABILITY_CODE_REQUIRED:
    "PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER_CAPABILITY_CODE_REQUIRED",
  OWNER_MODULE_REQUIRED:
    "PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER_OWNER_MODULE_REQUIRED",
  VERSION_INVALID: "PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER_VERSION_INVALID",
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
 * Project an explicit caller-supplied platform capability descriptor.
 *
 * Requires capabilityCode and ownerModule. Optional version is projected
 * through the certified Contract Version adapter when supplied. Optional
 * status is passed through without inference.
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectPlatformCapabilityDescriptor(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      adapterError(
        PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER_ERROR.INVALID,
        "Platform capability descriptor input must be a plain object"
      )
    );
  }

  if (!("capabilityCode" in input) || input.capabilityCode === undefined) {
    return fail(
      adapterError(
        PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER_ERROR.CAPABILITY_CODE_REQUIRED,
        "Platform capability descriptor projection requires an explicit capabilityCode",
        "capabilityCode"
      )
    );
  }

  if (!("ownerModule" in input) || input.ownerModule === undefined) {
    return fail(
      adapterError(
        PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER_ERROR.OWNER_MODULE_REQUIRED,
        "Platform capability descriptor projection requires an explicit ownerModule",
        "ownerModule"
      )
    );
  }

  /** @type {{
   *   capabilityCode: *,
   *   ownerModule: *,
   *   version?: *,
   *   status?: *,
   * }} */
  const payload = {
    capabilityCode: input.capabilityCode,
    ownerModule: input.ownerModule,
  };

  if ("version" in input && input.version !== undefined) {
    const versionResult = projectContractVersion(input.version);
    if (!versionResult.ok) {
      return fail(
        adapterError(
          PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER_ERROR.VERSION_INVALID,
          "Platform capability descriptor version must be a valid ContractVersion",
          "version"
        )
      );
    }
    payload.version = versionResult.value;
  }

  if ("status" in input && input.status !== undefined) {
    payload.status = input.status;
  }

  return createPlatformCapabilityDescriptor(payload);
}
