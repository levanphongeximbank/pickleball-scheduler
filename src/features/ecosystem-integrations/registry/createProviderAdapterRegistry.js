/**
 * Immutable provider adapter registry — explicit input only.
 * Not a global service locator. No network clients. No env reads.
 */

import { fail, ok } from "../../../core/platform/index.js";
import { createProviderAdapterDescriptor } from "../contracts/providerAdapterDescriptor.js";
import { createConnectorCapabilityBinding } from "../contracts/connectorCapabilityBinding.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
} from "../contracts/shared.js";

export const PROVIDER_ADAPTER_REGISTRY_ERROR = Object.freeze({
  INVALID: "PROVIDER_ADAPTER_REGISTRY_INVALID",
  DUPLICATE_ADAPTER: "PROVIDER_ADAPTER_REGISTRY_DUPLICATE_ADAPTER",
  DUPLICATE_BINDING: "PROVIDER_ADAPTER_REGISTRY_DUPLICATE_BINDING",
  INVALID_BINDING: "PROVIDER_ADAPTER_REGISTRY_INVALID_BINDING",
  NOT_FOUND: "PROVIDER_ADAPTER_REGISTRY_NOT_FOUND",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createProviderAdapterRegistry(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        PROVIDER_ADAPTER_REGISTRY_ERROR.INVALID,
        "ProviderAdapterRegistry input must be a plain object"
      )
    );
  }

  const adaptersRaw = Array.isArray(input.adapters) ? input.adapters : [];
  const bindingsRaw = Array.isArray(input.bindings) ? input.bindings : [];

  /** @type {Map<string, object>} */
  const adaptersById = new Map();
  /** @type {Map<string, object>} */
  const bindingsById = new Map();
  /** @type {Map<string, object[]>} */
  const bindingsByCapability = new Map();

  for (let i = 0; i < adaptersRaw.length; i += 1) {
    const result = createProviderAdapterDescriptor(adaptersRaw[i]);
    if (!result.ok) {
      return fail(
        contractError(
          PROVIDER_ADAPTER_REGISTRY_ERROR.INVALID,
          `adapters[${i}] is invalid: ${result.error.message}`,
          "adapters"
        )
      );
    }
    const descriptor = result.value;
    if (adaptersById.has(descriptor.adapterId)) {
      return fail(
        contractError(
          PROVIDER_ADAPTER_REGISTRY_ERROR.DUPLICATE_ADAPTER,
          `Duplicate adapterId: ${descriptor.adapterId}`,
          "adapters"
        )
      );
    }
    adaptersById.set(descriptor.adapterId, descriptor);
  }

  for (let i = 0; i < bindingsRaw.length; i += 1) {
    const result = createConnectorCapabilityBinding(bindingsRaw[i]);
    if (!result.ok) {
      return fail(
        contractError(
          PROVIDER_ADAPTER_REGISTRY_ERROR.INVALID,
          `bindings[${i}] is invalid: ${result.error.message}`,
          "bindings"
        )
      );
    }
    const binding = result.value;
    if (bindingsById.has(binding.bindingId)) {
      return fail(
        contractError(
          PROVIDER_ADAPTER_REGISTRY_ERROR.DUPLICATE_BINDING,
          `Duplicate bindingId: ${binding.bindingId}`,
          "bindings"
        )
      );
    }
    if (!adaptersById.has(binding.adapterId)) {
      return fail(
        contractError(
          PROVIDER_ADAPTER_REGISTRY_ERROR.INVALID_BINDING,
          `Binding references unknown adapterId: ${binding.adapterId}`,
          "bindings"
        )
      );
    }
    const adapter = adaptersById.get(binding.adapterId);
    if (!adapter.supportedCapabilityIds.includes(binding.capabilityId)) {
      return fail(
        contractError(
          PROVIDER_ADAPTER_REGISTRY_ERROR.INVALID_BINDING,
          `Adapter ${binding.adapterId} does not declare capability ${binding.capabilityId}`,
          "bindings"
        )
      );
    }
    bindingsById.set(binding.bindingId, binding);
    const list = bindingsByCapability.get(binding.capabilityId) ?? [];
    list.push(binding);
    bindingsByCapability.set(binding.capabilityId, list);
  }

  const adapterList = Object.freeze(
    [...adaptersById.values()].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.adapterId.localeCompare(b.adapterId);
    })
  );
  const bindingList = Object.freeze(
    [...bindingsById.values()].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.bindingId.localeCompare(b.bindingId);
    })
  );

  const registry = {
    listAdapters() {
      return adapterList;
    },
    listBindings() {
      return bindingList;
    },
    getAdapter(adapterId) {
      if (typeof adapterId !== "string" || !adaptersById.has(adapterId)) {
        return fail(
          contractError(
            PROVIDER_ADAPTER_REGISTRY_ERROR.NOT_FOUND,
            `Adapter not found: ${String(adapterId)}`,
            "adapterId"
          )
        );
      }
      return ok(adaptersById.get(adapterId));
    },
    getBinding(bindingId) {
      if (typeof bindingId !== "string" || !bindingsById.has(bindingId)) {
        return fail(
          contractError(
            PROVIDER_ADAPTER_REGISTRY_ERROR.NOT_FOUND,
            `Binding not found: ${String(bindingId)}`,
            "bindingId"
          )
        );
      }
      return ok(bindingsById.get(bindingId));
    },
    /**
     * Deterministic adapters for a capability (priority then adapterId).
     * @param {string} capabilityId
     */
    findAdaptersByCapability(capabilityId) {
      if (typeof capabilityId !== "string" || capabilityId.trim().length === 0) {
        return fail(
          contractError(
            PROVIDER_ADAPTER_REGISTRY_ERROR.INVALID,
            "capabilityId must be a non-empty string",
            "capabilityId"
          )
        );
      }
      const id = capabilityId.trim();
      const fromBindings = bindingsByCapability.get(id) ?? [];
      /** @type {Map<string, object>} */
      const matched = new Map();
      for (const binding of fromBindings) {
        const adapter = adaptersById.get(binding.adapterId);
        if (adapter) matched.set(adapter.adapterId, adapter);
      }
      for (const adapter of adapterList) {
        if (adapter.supportedCapabilityIds.includes(id)) {
          matched.set(adapter.adapterId, adapter);
        }
      }
      return ok(
        Object.freeze(
          [...matched.values()].sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.adapterId.localeCompare(b.adapterId);
          })
        )
      );
    },
  };

  return ok(deepFreeze(registry));
}
