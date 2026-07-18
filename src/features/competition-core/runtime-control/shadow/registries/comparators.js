/**
 * Shadow comparator registry (Phase 3A.3).
 * Descriptor-only — never invokes comparators. Empty = callers use generic compareShadowResults.
 */

import { isRuntimeCapability } from "../../constants/runtimeScopes.js";
import {
  REGISTRY_REASON_CODE,
  registryFailure,
  registrySuccess,
  compareCapabilityKeys,
} from "../../registries/registryReasonCodes.js";

export const SHADOW_COMPARATOR_REGISTRY_VERSION = "3a3.0";

/**
 * @typedef {Object} ShadowComparatorEntry
 * @property {string} capability
 * @property {string} modulePath
 * @property {string} comparatorId
 * @property {Readonly<Record<string, unknown>>} metadata
 */

export function createShadowComparatorRegistry() {
  /** @type {Map<string, ShadowComparatorEntry>} */
  const byCapability = new Map();
  let frozen = false;

  function register(registration) {
    if (frozen) {
      return registryFailure(REGISTRY_REASON_CODE.REGISTRY_LOCKED, [
        "shadow comparator registry is frozen",
      ]);
    }
    if (!registration || typeof registration !== "object") {
      return registryFailure(REGISTRY_REASON_CODE.INVALID_REGISTRY_ENTRY, [
        "registration must be an object",
      ]);
    }

    /** @type {string[]} */
    const errors = [];
    if (!isRuntimeCapability(registration.capability)) {
      errors.push(`invalid capability: ${String(registration.capability)}`);
    }
    if (typeof registration.modulePath !== "string" || !registration.modulePath) {
      errors.push("modulePath must be a non-empty string");
    }
    const comparatorId =
      registration.comparatorId === undefined
        ? registration.capability
        : registration.comparatorId;
    if (typeof comparatorId !== "string" || !comparatorId) {
      errors.push("comparatorId must be a non-empty string when provided");
    }

    if (errors.length > 0) {
      const reasonCode = !isRuntimeCapability(registration.capability)
        ? REGISTRY_REASON_CODE.INVALID_CAPABILITY_ID
        : REGISTRY_REASON_CODE.INVALID_REGISTRY_ENTRY;
      return registryFailure(reasonCode, errors);
    }

    if (byCapability.has(registration.capability)) {
      return registryFailure(REGISTRY_REASON_CODE.DUPLICATE_REGISTRATION, [
        `comparator already registered for: ${registration.capability}`,
      ]);
    }

    const metadata =
      registration.metadata && typeof registration.metadata === "object"
        ? Object.freeze({ ...registration.metadata })
        : Object.freeze({});

    const entry = Object.freeze({
      capability: registration.capability,
      modulePath: registration.modulePath,
      comparatorId,
      metadata,
    });
    byCapability.set(registration.capability, entry);
    return registrySuccess(entry, { registration: entry });
  }

  function resolve(capability) {
    if (!isRuntimeCapability(capability)) {
      return registryFailure(REGISTRY_REASON_CODE.INVALID_CAPABILITY_ID, [
        `invalid capability: ${String(capability)}`,
      ]);
    }
    const entry = byCapability.get(capability);
    if (!entry) {
      return registryFailure(REGISTRY_REASON_CODE.COMPARATOR_NOT_REGISTERED, [
        `comparator not registered for: ${capability}`,
      ]);
    }
    return registrySuccess(entry);
  }

  function list() {
    const keys = [...byCapability.keys()].sort(compareCapabilityKeys);
    return Object.freeze(keys.map((k) => byCapability.get(k)));
  }

  function has(capability) {
    return typeof capability === "string" && byCapability.has(capability);
  }

  function unregister(capability) {
    if (frozen) {
      return registryFailure(REGISTRY_REASON_CODE.REGISTRY_LOCKED, [
        "shadow comparator registry is frozen",
      ]);
    }
    if (typeof capability !== "string") {
      return registryFailure(REGISTRY_REASON_CODE.INVALID_CAPABILITY_ID, [
        `invalid capability: ${String(capability)}`,
      ]);
    }
    return byCapability.delete(capability)
      ? registrySuccess(true)
      : registryFailure(REGISTRY_REASON_CODE.COMPARATOR_NOT_REGISTERED, [
          `comparator not registered for: ${capability}`,
        ]);
  }

  function freeze() {
    frozen = true;
    return registrySuccess(true);
  }

  return Object.freeze({
    register,
    resolve,
    list,
    has,
    unregister,
    freeze,
    isFrozen: () => frozen,
    isEmpty: () => byCapability.size === 0,
    clear: () => {
      if (frozen) {
        return registryFailure(REGISTRY_REASON_CODE.REGISTRY_LOCKED, [
          "shadow comparator registry is frozen",
        ]);
      }
      byCapability.clear();
      return registrySuccess(true);
    },
    size: () => byCapability.size,
  });
}

export const defaultShadowComparatorRegistry = createShadowComparatorRegistry();

export function registerShadowComparator(registration) {
  return defaultShadowComparatorRegistry.register(registration);
}

export function resolveShadowComparator(capability) {
  return defaultShadowComparatorRegistry.resolve(capability);
}

export function getShadowComparatorRegistration(capability) {
  const result = defaultShadowComparatorRegistry.resolve(capability);
  return result.ok ? result.value : null;
}

export function listShadowComparatorRegistrations() {
  return defaultShadowComparatorRegistry.list();
}

export function isShadowComparatorRegistryEmpty() {
  return defaultShadowComparatorRegistry.isEmpty();
}

export function unregisterShadowComparator(capability) {
  return defaultShadowComparatorRegistry.unregister(capability);
}

export function resetShadowComparatorRegistryForTests() {
  if (defaultShadowComparatorRegistry.isFrozen()) {
    throw new Error("cannot reset frozen shadow comparator registry in tests");
  }
  defaultShadowComparatorRegistry.clear();
}
