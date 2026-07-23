/**
 * Integration Port Descriptor contract (Platform Core Phase 1F–1J).
 *
 * Descriptive representation of an integration port. Does not create
 * adapters, inject dependencies, connect external APIs, or execute
 * capabilities.
 */

import { fail, ok } from "./result.js";
import { createContractVersion } from "./contractVersion.js";

/**
 * @typedef {{
 *   portName: string,
 *   ownerModule: string,
 *   direction: string,
 *   version?: string,
 * }} IntegrationPortDescriptor
 */

export const INTEGRATION_PORT_DESCRIPTOR_ERROR = Object.freeze({
  INVALID: "INTEGRATION_PORT_DESCRIPTOR_INVALID",
  PORT_NAME_INVALID: "INTEGRATION_PORT_DESCRIPTOR_PORT_NAME_INVALID",
  OWNER_MODULE_INVALID: "INTEGRATION_PORT_DESCRIPTOR_OWNER_MODULE_INVALID",
  DIRECTION_INVALID: "INTEGRATION_PORT_DESCRIPTOR_DIRECTION_INVALID",
  VERSION_INVALID: "INTEGRATION_PORT_DESCRIPTOR_VERSION_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function integrationPortDescriptorError(code, message, field) {
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
      integrationPortDescriptorError(
        errorCode,
        `IntegrationPortDescriptor ${label} must be a string`,
        field
      )
    );
  }

  const normalized = input[field].trim();
  if (normalized.length === 0) {
    return fail(
      integrationPortDescriptorError(
        errorCode,
        `IntegrationPortDescriptor ${label} must be a non-empty string`,
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
export function createIntegrationPortDescriptor(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      integrationPortDescriptorError(
        INTEGRATION_PORT_DESCRIPTOR_ERROR.INVALID,
        "IntegrationPortDescriptor input must be a plain object"
      )
    );
  }

  const portNameResult = requireTrimmedString(
    input,
    "portName",
    INTEGRATION_PORT_DESCRIPTOR_ERROR.PORT_NAME_INVALID,
    "portName"
  );
  if (!portNameResult.ok) return portNameResult;

  const ownerModuleResult = requireTrimmedString(
    input,
    "ownerModule",
    INTEGRATION_PORT_DESCRIPTOR_ERROR.OWNER_MODULE_INVALID,
    "ownerModule"
  );
  if (!ownerModuleResult.ok) return ownerModuleResult;

  const directionResult = requireTrimmedString(
    input,
    "direction",
    INTEGRATION_PORT_DESCRIPTOR_ERROR.DIRECTION_INVALID,
    "direction"
  );
  if (!directionResult.ok) return directionResult;

  /** @type {IntegrationPortDescriptor} */
  const descriptor = {
    portName: portNameResult.value,
    ownerModule: ownerModuleResult.value,
    direction: directionResult.value,
  };

  if ("version" in input && input.version !== undefined) {
    const versionResult = createContractVersion(input.version);
    if (!versionResult.ok) {
      return fail(
        integrationPortDescriptorError(
          INTEGRATION_PORT_DESCRIPTOR_ERROR.VERSION_INVALID,
          "IntegrationPortDescriptor version must be a valid ContractVersion",
          "version"
        )
      );
    }
    descriptor.version = versionResult.value;
  }

  return ok(Object.freeze(descriptor));
}

/**
 * @param {*} value
 * @returns {value is IntegrationPortDescriptor}
 */
export function isIntegrationPortDescriptor(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (
    typeof value.portName !== "string" ||
    typeof value.ownerModule !== "string" ||
    typeof value.direction !== "string"
  ) {
    return false;
  }
  return createIntegrationPortDescriptor(value).ok === true;
}
