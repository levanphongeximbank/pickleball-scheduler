/**
 * Capability / executor registry (Phase 3A.3 — Integration Bootstrap).
 *
 * Factory + default singleton. Empty by default. No import-time registrations.
 * Integrator-owned. Descriptor-only — does not invoke executors.
 *
 * Decision: single registry covers capability + executor/adapter reference.
 * A separate runtime-adapter registry is NOT created (see runtime-registry-decision.md).
 */

import {
  RUNTIME_EXECUTOR,
  isRuntimeCapability,
  isRuntimeExecutor,
} from "../constants/runtimeScopes.js";
import {
  REGISTRY_REASON_CODE,
  registryFailure,
  registrySuccess,
  compareCapabilityKeys,
} from "./registryReasonCodes.js";

export const CAPABILITY_EXECUTOR_REGISTRY_VERSION = "3a3.0";

/**
 * @typedef {Object} CapabilityExecutorEntry
 * @property {string} capability
 * @property {string} executor
 * @property {string|null} modulePath
 * @property {Readonly<Record<string, unknown>>} metadata
 */

/**
 * @returns {{
 *   register: Function,
 *   resolve: Function,
 *   list: Function,
 *   has: Function,
 *   unregister: Function,
 *   freeze: Function,
 *   isFrozen: Function,
 *   isEmpty: Function,
 *   clear: Function,
 *   size: Function,
 * }}
 */
export function createCapabilityExecutorRegistry() {
  /** @type {Map<string, CapabilityExecutorEntry>} */
  const byCapability = new Map();
  let frozen = false;

  /**
   * @param {object} registration
   */
  function register(registration) {
    if (frozen) {
      return registryFailure(REGISTRY_REASON_CODE.REGISTRY_LOCKED, [
        "capability executor registry is frozen",
      ]);
    }
    if (!registration || typeof registration !== "object") {
      return registryFailure(REGISTRY_REASON_CODE.INVALID_REGISTRY_ENTRY, [
        "registration must be an object",
      ]);
    }

    const capability = registration.capability;
    const executor = registration.executor;
    /** @type {string[]} */
    const errors = [];

    if (!isRuntimeCapability(capability)) {
      errors.push(`invalid capability: ${String(capability)}`);
    }
    if (!isRuntimeExecutor(executor)) {
      errors.push(`invalid executor: ${String(executor)}`);
    }
    if (executor && executor !== RUNTIME_EXECUTOR.LEGACY) {
      errors.push(`executor ${String(executor)} is not allowed until Owner GO`);
    }

    const modulePath =
      registration.modulePath === undefined || registration.modulePath === null
        ? null
        : registration.modulePath;
    if (modulePath !== null && typeof modulePath !== "string") {
      errors.push("modulePath must be a string or null");
    }

    if (errors.length > 0) {
      const reasonCode = !isRuntimeCapability(capability)
        ? REGISTRY_REASON_CODE.INVALID_CAPABILITY_ID
        : REGISTRY_REASON_CODE.INVALID_REGISTRY_ENTRY;
      return registryFailure(reasonCode, errors);
    }

    if (byCapability.has(capability)) {
      return registryFailure(REGISTRY_REASON_CODE.DUPLICATE_REGISTRATION, [
        `capability already registered: ${capability}`,
      ]);
    }

    const metadata =
      registration.metadata && typeof registration.metadata === "object"
        ? Object.freeze({ ...registration.metadata })
        : Object.freeze({});

    const entry = Object.freeze({
      capability,
      executor,
      modulePath,
      metadata,
    });
    byCapability.set(capability, entry);
    return registrySuccess(entry, { registration: entry });
  }

  /**
   * @param {unknown} capability
   */
  function resolve(capability) {
    if (!isRuntimeCapability(capability)) {
      return registryFailure(REGISTRY_REASON_CODE.INVALID_CAPABILITY_ID, [
        `invalid capability: ${String(capability)}`,
      ]);
    }
    const entry = byCapability.get(capability);
    if (!entry) {
      return registryFailure(REGISTRY_REASON_CODE.CAPABILITY_NOT_REGISTERED, [
        `capability not registered: ${capability}`,
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
        "capability executor registry is frozen",
      ]);
    }
    if (typeof capability !== "string") {
      return registryFailure(REGISTRY_REASON_CODE.INVALID_CAPABILITY_ID, [
        `invalid capability: ${String(capability)}`,
      ]);
    }
    const removed = byCapability.delete(capability);
    return removed
      ? registrySuccess(true)
      : registryFailure(REGISTRY_REASON_CODE.CAPABILITY_NOT_REGISTERED, [
          `capability not registered: ${capability}`,
        ]);
  }

  function freeze() {
    frozen = true;
    return registrySuccess(true);
  }

  function isFrozen() {
    return frozen;
  }

  function isEmpty() {
    return byCapability.size === 0;
  }

  function clear() {
    if (frozen) {
      return registryFailure(REGISTRY_REASON_CODE.REGISTRY_LOCKED, [
        "capability executor registry is frozen",
      ]);
    }
    byCapability.clear();
    return registrySuccess(true);
  }

  function size() {
    return byCapability.size;
  }

  return Object.freeze({
    register,
    resolve,
    list,
    has,
    unregister,
    freeze,
    isFrozen,
    isEmpty,
    clear,
    size,
  });
}

/** Default singleton — empty; no import-time registrations. */
export const defaultCapabilityExecutorRegistry = createCapabilityExecutorRegistry();

export function registerCapabilityExecutor(registration) {
  return defaultCapabilityExecutorRegistry.register(registration);
}

export function resolveCapabilityExecutor(capability) {
  return defaultCapabilityExecutorRegistry.resolve(capability);
}

export function getCapabilityExecutorRegistration(capability) {
  const result = defaultCapabilityExecutorRegistry.resolve(capability);
  return result.ok ? result.value : null;
}

export function listCapabilityExecutorRegistrations() {
  return defaultCapabilityExecutorRegistry.list();
}

export function isCapabilityExecutorRegistryEmpty() {
  return defaultCapabilityExecutorRegistry.isEmpty();
}

export function unregisterCapabilityExecutor(capability) {
  return defaultCapabilityExecutorRegistry.unregister(capability);
}

export function freezeCapabilityExecutorRegistry() {
  return defaultCapabilityExecutorRegistry.freeze();
}

export function isCapabilityExecutorRegistryFrozen() {
  return defaultCapabilityExecutorRegistry.isFrozen();
}

/** Test-only: clear singleton when not frozen. Prefer createCapabilityExecutorRegistry() for isolation. */
export function resetCapabilityExecutorRegistryForTests() {
  if (defaultCapabilityExecutorRegistry.isFrozen()) {
    throw new Error("cannot reset frozen capability executor registry in tests");
  }
  defaultCapabilityExecutorRegistry.clear();
}
