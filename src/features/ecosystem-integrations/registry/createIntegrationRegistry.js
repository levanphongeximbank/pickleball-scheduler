/**
 * Immutable integration registry — explicit input only.
 * Not a service locator. No network clients. No env reads.
 */

import { fail, ok } from "../../../core/platform/index.js";
import { createConnectorDescriptor } from "../contracts/connectorDescriptor.js";
import { createProviderCapabilityDescriptor } from "../contracts/providerCapabilityDescriptor.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
} from "../contracts/shared.js";

export const INTEGRATION_REGISTRY_ERROR = Object.freeze({
  INVALID: "INTEGRATION_REGISTRY_INVALID",
  DUPLICATE_CONNECTOR: "INTEGRATION_REGISTRY_DUPLICATE_CONNECTOR",
  DUPLICATE_CAPABILITY: "INTEGRATION_REGISTRY_DUPLICATE_CAPABILITY",
  DUPLICATE_PROVIDER: "INTEGRATION_REGISTRY_DUPLICATE_PROVIDER",
  NOT_FOUND: "INTEGRATION_REGISTRY_NOT_FOUND",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createIntegrationRegistry(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        INTEGRATION_REGISTRY_ERROR.INVALID,
        "IntegrationRegistry input must be a plain object"
      )
    );
  }

  const connectorsRaw = Array.isArray(input.connectors) ? input.connectors : [];
  const capabilitiesRaw = Array.isArray(input.capabilities)
    ? input.capabilities
    : [];

  /** @type {Map<string, object>} */
  const connectorsById = new Map();
  /** @type {Map<string, object>} */
  const connectorsByProviderKey = new Map();
  /** @type {Map<string, object>} */
  const capabilitiesById = new Map();

  for (let i = 0; i < connectorsRaw.length; i += 1) {
    const result = createConnectorDescriptor(connectorsRaw[i]);
    if (!result.ok) {
      return fail(
        contractError(
          INTEGRATION_REGISTRY_ERROR.INVALID,
          `connectors[${i}] is invalid: ${result.error.message}`,
          "connectors"
        )
      );
    }
    const descriptor = result.value;
    if (connectorsById.has(descriptor.connectorId)) {
      return fail(
        contractError(
          INTEGRATION_REGISTRY_ERROR.DUPLICATE_CONNECTOR,
          `Duplicate connectorId: ${descriptor.connectorId}`,
          "connectors"
        )
      );
    }
    if (connectorsByProviderKey.has(descriptor.providerKey)) {
      return fail(
        contractError(
          INTEGRATION_REGISTRY_ERROR.DUPLICATE_PROVIDER,
          `Duplicate providerKey: ${descriptor.providerKey}`,
          "connectors"
        )
      );
    }
    connectorsById.set(descriptor.connectorId, descriptor);
    connectorsByProviderKey.set(descriptor.providerKey, descriptor);
  }

  for (let i = 0; i < capabilitiesRaw.length; i += 1) {
    const result = createProviderCapabilityDescriptor(capabilitiesRaw[i]);
    if (!result.ok) {
      return fail(
        contractError(
          INTEGRATION_REGISTRY_ERROR.INVALID,
          `capabilities[${i}] is invalid: ${result.error.message}`,
          "capabilities"
        )
      );
    }
    const descriptor = result.value;
    if (capabilitiesById.has(descriptor.capabilityId)) {
      return fail(
        contractError(
          INTEGRATION_REGISTRY_ERROR.DUPLICATE_CAPABILITY,
          `Duplicate capabilityId: ${descriptor.capabilityId}`,
          "capabilities"
        )
      );
    }
    capabilitiesById.set(descriptor.capabilityId, descriptor);
  }

  const connectorList = Object.freeze([...connectorsById.values()]);
  const capabilityList = Object.freeze([...capabilitiesById.values()]);

  const registry = {
    listConnectors() {
      return connectorList;
    },
    listCapabilities() {
      return capabilityList;
    },
    getConnector(connectorId) {
      if (typeof connectorId !== "string" || !connectorsById.has(connectorId)) {
        return fail(
          contractError(
            INTEGRATION_REGISTRY_ERROR.NOT_FOUND,
            `Connector not found: ${String(connectorId)}`,
            "connectorId"
          )
        );
      }
      return ok(connectorsById.get(connectorId));
    },
    getConnectorByProviderKey(providerKey) {
      if (
        typeof providerKey !== "string" ||
        !connectorsByProviderKey.has(providerKey)
      ) {
        return fail(
          contractError(
            INTEGRATION_REGISTRY_ERROR.NOT_FOUND,
            `Connector providerKey not found: ${String(providerKey)}`,
            "providerKey"
          )
        );
      }
      return ok(connectorsByProviderKey.get(providerKey));
    },
    getCapability(capabilityId) {
      if (
        typeof capabilityId !== "string" ||
        !capabilitiesById.has(capabilityId)
      ) {
        return fail(
          contractError(
            INTEGRATION_REGISTRY_ERROR.NOT_FOUND,
            `Capability not found: ${String(capabilityId)}`,
            "capabilityId"
          )
        );
      }
      return ok(capabilitiesById.get(capabilityId));
    },
    /**
     * Deterministic capability discovery / filtering.
     * @param {{
     *   operation?: string,
     *   webhookSupport?: boolean,
     *   sandboxSupport?: boolean,
     *   idempotencySupport?: boolean,
     *   deliveryMode?: string,
     * }} [filter]
     */
    findCapabilities(filter = {}) {
      if (!isPlainObject(filter)) {
        return fail(
          contractError(
            INTEGRATION_REGISTRY_ERROR.INVALID,
            "findCapabilities filter must be a plain object"
          )
        );
      }
      const matched = capabilityList.filter((cap) => {
        if (
          filter.operation != null &&
          !cap.supportedOperations.includes(filter.operation)
        ) {
          return false;
        }
        if (
          filter.webhookSupport != null &&
          cap.webhookSupport !== filter.webhookSupport
        ) {
          return false;
        }
        if (
          filter.sandboxSupport != null &&
          cap.sandboxSupport !== filter.sandboxSupport
        ) {
          return false;
        }
        if (
          filter.idempotencySupport != null &&
          cap.idempotencySupport !== filter.idempotencySupport
        ) {
          return false;
        }
        if (
          filter.deliveryMode != null &&
          !cap.deliveryModes.includes(filter.deliveryMode)
        ) {
          return false;
        }
        return true;
      });
      return ok(Object.freeze(matched));
    },
    /**
     * Connectors supporting a capability id reference in supportedCapabilities.
     * @param {string} capabilityId
     */
    findConnectorsByCapability(capabilityId) {
      if (typeof capabilityId !== "string" || capabilityId.trim().length === 0) {
        return fail(
          contractError(
            INTEGRATION_REGISTRY_ERROR.INVALID,
            "capabilityId must be a non-empty string",
            "capabilityId"
          )
        );
      }
      const id = capabilityId.trim();
      return ok(
        Object.freeze(
          connectorList.filter((c) => c.supportedCapabilities.includes(id))
        )
      );
    },
  };

  return ok(deepFreeze(registry));
}
