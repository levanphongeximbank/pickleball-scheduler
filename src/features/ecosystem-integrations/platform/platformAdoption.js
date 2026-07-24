/**
 * Platform Core adoption — pure projections only.
 * Consumes public Platform Core surface; does not edit Platform Core.
 */

import {
  createIntegrationPortDescriptor,
  fail,
  projectIntegrationPortDescriptor,
  projectPlatformCapabilityDescriptor,
  createPlatformCapabilityDescriptor,
  hasPlatformCapability,
  findPlatformCapability,
} from "../../../core/platform/index.js";
import { contractError, deepFreeze, isPlainObject } from "../contracts/shared.js";

export const ECO_PLATFORM_ADAPTER_ERROR = Object.freeze({
  INVALID: "ECO_PLATFORM_ADAPTER_INVALID",
  CONNECTOR_REQUIRED: "ECO_PLATFORM_ADAPTER_CONNECTOR_REQUIRED",
});

/**
 * Project an ECO connector descriptor into Platform IntegrationPortDescriptor.
 * @param {*} connectorDescriptor
 */
export function projectConnectorToIntegrationPort(connectorDescriptor) {
  if (!isPlainObject(connectorDescriptor)) {
    return fail(
      contractError(
        ECO_PLATFORM_ADAPTER_ERROR.INVALID,
        "connectorDescriptor must be a plain object"
      )
    );
  }
  if (typeof connectorDescriptor.connectorId !== "string") {
    return fail(
      contractError(
        ECO_PLATFORM_ADAPTER_ERROR.CONNECTOR_REQUIRED,
        "connectorId is required",
        "connectorId"
      )
    );
  }

  const direction =
    connectorDescriptor.direction === "BIDIRECTIONAL"
      ? "bidirectional"
      : String(connectorDescriptor.direction || "outbound").toLowerCase();

  return createIntegrationPortDescriptor({
    portName: connectorDescriptor.connectorId,
    ownerModule: "ecosystem-integrations",
    direction,
    version: connectorDescriptor.contractVersion,
  });
}

/**
 * Re-export Platform projection helpers for ECO consumers (barrel convenience).
 */
export {
  projectIntegrationPortDescriptor,
  projectPlatformCapabilityDescriptor,
  createPlatformCapabilityDescriptor,
  hasPlatformCapability,
  findPlatformCapability,
};

/**
 * Assert Platform Core exposes integration capability discovery (read-only).
 */
export function assertPlatformIntegrationCapabilitySurface() {
  const hasDescriptor = hasPlatformCapability("INTEGRATION_PORT_DESCRIPTOR");
  const hasDiscovery = hasPlatformCapability("CAPABILITY_DISCOVERY");
  return deepFreeze({
    hasIntegrationPortDescriptor: hasDescriptor,
    hasCapabilityDiscovery: hasDiscovery,
    ready: hasDescriptor && hasDiscovery,
  });
}
