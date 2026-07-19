/**
 * Shadow eligibility allowlist registry (Phase 3A.3).
 * Empty = deny. Not wired into resolveShadowEligibility in Wave 0.
 */

import { isRuntimeCapability } from "../../constants/runtimeScopes.js";
import {
  REGISTRY_REASON_CODE,
  registryFailure,
  registrySuccess,
  compareCapabilityKeys,
} from "../../registries/registryReasonCodes.js";

export const SHADOW_ELIGIBILITY_ALLOWLIST_REGISTRY_VERSION = "3a3.0";

/**
 * @typedef {Object} ShadowEligibilityAllowlistEntry
 * @property {string} capability
 * @property {ReadonlyArray<string>} operations
 * @property {Readonly<Record<string, unknown>>} metadata
 */

export function getDefaultCapabilityAllowlist() {
  return Object.freeze([]);
}

export function getDefaultOperationAllowlist() {
  return Object.freeze([]);
}

export function createEligibilityAllowlistRegistry() {
  /** @type {Map<string, ShadowEligibilityAllowlistEntry>} */
  const byCapability = new Map();
  let frozen = false;

  function register(registration) {
    if (frozen) {
      return registryFailure(REGISTRY_REASON_CODE.REGISTRY_LOCKED, [
        "eligibility allowlist registry is frozen",
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
    if (!Array.isArray(registration.operations)) {
      errors.push("operations must be an array of strings");
    } else if (registration.operations.some((op) => typeof op !== "string")) {
      errors.push("operations must contain only strings");
    }

    if (errors.length > 0) {
      const reasonCode = !isRuntimeCapability(registration.capability)
        ? REGISTRY_REASON_CODE.INVALID_CAPABILITY_ID
        : REGISTRY_REASON_CODE.INVALID_REGISTRY_ENTRY;
      return registryFailure(reasonCode, errors);
    }

    if (byCapability.has(registration.capability)) {
      return registryFailure(REGISTRY_REASON_CODE.DUPLICATE_REGISTRATION, [
        `allowlist already registered for: ${registration.capability}`,
      ]);
    }

    const metadata =
      registration.metadata && typeof registration.metadata === "object"
        ? Object.freeze({ ...registration.metadata })
        : Object.freeze({});

    const entry = Object.freeze({
      capability: registration.capability,
      operations: Object.freeze([...registration.operations].sort()),
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
      return registryFailure(REGISTRY_REASON_CODE.ALLOWLIST_NOT_REGISTERED, [
        `allowlist not registered for: ${capability}`,
      ]);
    }
    return registrySuccess(entry);
  }

  /**
   * Resolve allowlists for a request. Empty registry → empty arrays (deny).
   * @param {object} [input]
   * @param {string} [input.capability]
   */
  function resolveAllowlists(input = {}) {
    if (byCapability.size === 0) {
      return Object.freeze({
        capabilityAllowlist: getDefaultCapabilityAllowlist(),
        operationAllowlist: getDefaultOperationAllowlist(),
        eligibleByRegistry: false,
      });
    }

    const capability = typeof input.capability === "string" ? input.capability : null;
    const capabilityAllowlist = Object.freeze(
      [...byCapability.keys()].sort(compareCapabilityKeys)
    );

    if (!capability || !byCapability.has(capability)) {
      return Object.freeze({
        capabilityAllowlist,
        operationAllowlist: getDefaultOperationAllowlist(),
        eligibleByRegistry: false,
      });
    }

    const entry = byCapability.get(capability);
    const operations = entry?.operations ?? [];
    return Object.freeze({
      capabilityAllowlist,
      operationAllowlist: Object.freeze([...operations]),
      eligibleByRegistry: operations.length > 0,
    });
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
        "eligibility allowlist registry is frozen",
      ]);
    }
    if (typeof capability !== "string") {
      return registryFailure(REGISTRY_REASON_CODE.INVALID_CAPABILITY_ID, [
        `invalid capability: ${String(capability)}`,
      ]);
    }
    return byCapability.delete(capability)
      ? registrySuccess(true)
      : registryFailure(REGISTRY_REASON_CODE.ALLOWLIST_NOT_REGISTERED, [
          `allowlist not registered for: ${capability}`,
        ]);
  }

  function freeze() {
    frozen = true;
    return registrySuccess(true);
  }

  return Object.freeze({
    register,
    resolve,
    resolveAllowlists,
    list,
    has,
    unregister,
    freeze,
    isFrozen: () => frozen,
    isEmpty: () => byCapability.size === 0,
    clear: () => {
      if (frozen) {
        return registryFailure(REGISTRY_REASON_CODE.REGISTRY_LOCKED, [
          "eligibility allowlist registry is frozen",
        ]);
      }
      byCapability.clear();
      return registrySuccess(true);
    },
    size: () => byCapability.size,
  });
}

export const defaultEligibilityAllowlistRegistry = createEligibilityAllowlistRegistry();

export function registerEligibilityAllowlist(registration) {
  return defaultEligibilityAllowlistRegistry.register(registration);
}

export function resolveEligibilityAllowlist(capability) {
  return defaultEligibilityAllowlistRegistry.resolve(capability);
}

export function getEligibilityAllowlistRegistration(capability) {
  const result = defaultEligibilityAllowlistRegistry.resolve(capability);
  return result.ok ? result.value : null;
}

export function resolveEligibilityAllowlistsFromRegistry(input = {}) {
  return defaultEligibilityAllowlistRegistry.resolveAllowlists(input);
}

export function listEligibilityAllowlistRegistrations() {
  return defaultEligibilityAllowlistRegistry.list();
}

export function isEligibilityAllowlistRegistryEmpty() {
  return defaultEligibilityAllowlistRegistry.isEmpty();
}

export function unregisterEligibilityAllowlist(capability) {
  return defaultEligibilityAllowlistRegistry.unregister(capability);
}

export function resetEligibilityAllowlistRegistryForTests() {
  if (defaultEligibilityAllowlistRegistry.isFrozen()) {
    throw new Error("cannot reset frozen eligibility allowlist registry in tests");
  }
  defaultEligibilityAllowlistRegistry.clear();
}
