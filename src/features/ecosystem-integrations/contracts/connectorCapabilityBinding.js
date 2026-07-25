/**
 * Connector ↔ capability ↔ adapter binding — immutable metadata.
 */

import { fail, ok } from "../../../core/platform/index.js";
import { CONNECTOR_CAPABILITY_BINDING_VERSION } from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireBoolean,
  requireNonEmptyString,
} from "./shared.js";

export const CONNECTOR_CAPABILITY_BINDING_ERROR = Object.freeze({
  INVALID: "CONNECTOR_CAPABILITY_BINDING_INVALID",
  CONNECTOR_INVALID: "CONNECTOR_CAPABILITY_BINDING_CONNECTOR_INVALID",
  CAPABILITY_INVALID: "CONNECTOR_CAPABILITY_BINDING_CAPABILITY_INVALID",
  ADAPTER_INVALID: "CONNECTOR_CAPABILITY_BINDING_ADAPTER_INVALID",
  FLAG_INVALID: "CONNECTOR_CAPABILITY_BINDING_FLAG_INVALID",
  VERSION_INVALID: "CONNECTOR_CAPABILITY_BINDING_VERSION_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createConnectorCapabilityBinding(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        CONNECTOR_CAPABILITY_BINDING_ERROR.INVALID,
        "ConnectorCapabilityBinding input must be a plain object"
      )
    );
  }

  const bindingId = requireNonEmptyString(
    input.bindingId ??
      `${input.connectorId ?? ""}::${input.capabilityId ?? ""}::${input.adapterId ?? ""}`,
    "bindingId",
    CONNECTOR_CAPABILITY_BINDING_ERROR.INVALID,
    "bindingId"
  );
  if (!bindingId.ok) return bindingId;

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? CONNECTOR_CAPABILITY_BINDING_VERSION,
    "contractVersion",
    CONNECTOR_CAPABILITY_BINDING_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const connectorId = requireNonEmptyString(
    input.connectorId,
    "connectorId",
    CONNECTOR_CAPABILITY_BINDING_ERROR.CONNECTOR_INVALID,
    "connectorId"
  );
  if (!connectorId.ok) return connectorId;

  const capabilityId = requireNonEmptyString(
    input.capabilityId,
    "capabilityId",
    CONNECTOR_CAPABILITY_BINDING_ERROR.CAPABILITY_INVALID,
    "capabilityId"
  );
  if (!capabilityId.ok) return capabilityId;

  const adapterId = requireNonEmptyString(
    input.adapterId,
    "adapterId",
    CONNECTOR_CAPABILITY_BINDING_ERROR.ADAPTER_INVALID,
    "adapterId"
  );
  if (!adapterId.ok) return adapterId;

  const primary = requireBoolean(
    input.primary ?? false,
    "primary",
    CONNECTOR_CAPABILITY_BINDING_ERROR.FLAG_INVALID
  );
  if (!primary.ok) return primary;

  const priority = Number.isInteger(input.priority) ? input.priority : 100;
  if (!Number.isInteger(priority) || priority < 0) {
    return fail(
      contractError(
        CONNECTOR_CAPABILITY_BINDING_ERROR.FLAG_INVALID,
        "priority must be a non-negative integer",
        "priority"
      )
    );
  }

  return ok(
    deepFreeze({
      bindingId: bindingId.value,
      contractVersion: contractVersion.value,
      connectorId: connectorId.value,
      capabilityId: capabilityId.value,
      adapterId: adapterId.value,
      primary: primary.value,
      priority,
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isConnectorCapabilityBinding(value) {
  return createConnectorCapabilityBinding(value).ok === true;
}
