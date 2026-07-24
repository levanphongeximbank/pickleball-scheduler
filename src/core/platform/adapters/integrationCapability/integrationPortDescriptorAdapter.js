/**
 * Integration Port Descriptor Adapter — projects caller-supplied port
 * descriptor fields into Platform Core IntegrationPortDescriptor.
 *
 * Does not create port implementations, construct clients/services, inject
 * dependencies, register ports, scan the filesystem, evaluate feature flags,
 * infer ownerModule/direction, or default version.
 */

import { fail } from "../../contracts/result.js";
import { createIntegrationPortDescriptor } from "../../contracts/integrationPortDescriptor.js";
import { projectContractVersion } from "../operationCompatibility/contractVersionAdapter.js";

export const INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR = Object.freeze({
  INVALID: "INTEGRATION_PORT_DESCRIPTOR_ADAPTER_INVALID",
  PORT_NAME_REQUIRED: "INTEGRATION_PORT_DESCRIPTOR_ADAPTER_PORT_NAME_REQUIRED",
  OWNER_MODULE_REQUIRED:
    "INTEGRATION_PORT_DESCRIPTOR_ADAPTER_OWNER_MODULE_REQUIRED",
  DIRECTION_REQUIRED: "INTEGRATION_PORT_DESCRIPTOR_ADAPTER_DIRECTION_REQUIRED",
  VERSION_INVALID: "INTEGRATION_PORT_DESCRIPTOR_ADAPTER_VERSION_INVALID",
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
 * Project an explicit caller-supplied integration port descriptor.
 *
 * Requires portName, ownerModule, and direction. Optional version is projected
 * through the certified Contract Version adapter when supplied.
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectIntegrationPortDescriptor(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      adapterError(
        INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR.INVALID,
        "Integration port descriptor input must be a plain object"
      )
    );
  }

  if (!("portName" in input) || input.portName === undefined) {
    return fail(
      adapterError(
        INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR.PORT_NAME_REQUIRED,
        "Integration port descriptor projection requires an explicit portName",
        "portName"
      )
    );
  }

  if (!("ownerModule" in input) || input.ownerModule === undefined) {
    return fail(
      adapterError(
        INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR.OWNER_MODULE_REQUIRED,
        "Integration port descriptor projection requires an explicit ownerModule",
        "ownerModule"
      )
    );
  }

  if (!("direction" in input) || input.direction === undefined) {
    return fail(
      adapterError(
        INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR.DIRECTION_REQUIRED,
        "Integration port descriptor projection requires an explicit direction",
        "direction"
      )
    );
  }

  /** @type {{
   *   portName: *,
   *   ownerModule: *,
   *   direction: *,
   *   version?: *,
   * }} */
  const payload = {
    portName: input.portName,
    ownerModule: input.ownerModule,
    direction: input.direction,
  };

  if ("version" in input && input.version !== undefined) {
    const versionResult = projectContractVersion(input.version);
    if (!versionResult.ok) {
      return fail(
        adapterError(
          INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR.VERSION_INVALID,
          "Integration port descriptor version must be a valid ContractVersion",
          "version"
        )
      );
    }
    payload.version = versionResult.value;
  }

  return createIntegrationPortDescriptor(payload);
}
