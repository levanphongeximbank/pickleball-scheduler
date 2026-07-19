/**
 * Shadow normalizer registry (Phase 3A.3).
 * Descriptor-only — never mutates payloads. Empty = generic normalizeShadowPayload.
 */

import { isRuntimeCapability } from "../../constants/runtimeScopes.js";
import {
  REGISTRY_REASON_CODE,
  registryFailure,
  registrySuccess,
  compareCapabilityKeys,
} from "../../registries/registryReasonCodes.js";

export const SHADOW_NORMALIZER_REGISTRY_VERSION = "3a3.0";

/**
 * @typedef {Object} ShadowNormalizerEntry
 * @property {string} capability
 * @property {string} modulePath
 * @property {string} normalizerId
 * @property {Readonly<Record<string, unknown>>} metadata
 */

export function createShadowNormalizerRegistry() {
  /** @type {Map<string, ShadowNormalizerEntry>} */
  const byCapability = new Map();
  let frozen = false;

  function register(registration) {
    if (frozen) {
      return registryFailure(REGISTRY_REASON_CODE.REGISTRY_LOCKED, [
        "shadow normalizer registry is frozen",
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
    const normalizerId =
      registration.normalizerId === undefined
        ? registration.capability
        : registration.normalizerId;
    if (typeof normalizerId !== "string" || !normalizerId) {
      errors.push("normalizerId must be a non-empty string when provided");
    }

    if (errors.length > 0) {
      const reasonCode = !isRuntimeCapability(registration.capability)
        ? REGISTRY_REASON_CODE.INVALID_CAPABILITY_ID
        : REGISTRY_REASON_CODE.INVALID_REGISTRY_ENTRY;
      return registryFailure(reasonCode, errors);
    }

    if (byCapability.has(registration.capability)) {
      return registryFailure(REGISTRY_REASON_CODE.DUPLICATE_REGISTRATION, [
        `normalizer already registered for: ${registration.capability}`,
      ]);
    }

    const metadata =
      registration.metadata && typeof registration.metadata === "object"
        ? Object.freeze({ ...registration.metadata })
        : Object.freeze({});

    const entry = Object.freeze({
      capability: registration.capability,
      modulePath: registration.modulePath,
      normalizerId,
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
      return registryFailure(REGISTRY_REASON_CODE.NORMALIZER_NOT_REGISTERED, [
        `normalizer not registered for: ${capability}`,
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
        "shadow normalizer registry is frozen",
      ]);
    }
    if (typeof capability !== "string") {
      return registryFailure(REGISTRY_REASON_CODE.INVALID_CAPABILITY_ID, [
        `invalid capability: ${String(capability)}`,
      ]);
    }
    return byCapability.delete(capability)
      ? registrySuccess(true)
      : registryFailure(REGISTRY_REASON_CODE.NORMALIZER_NOT_REGISTERED, [
          `normalizer not registered for: ${capability}`,
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
          "shadow normalizer registry is frozen",
        ]);
      }
      byCapability.clear();
      return registrySuccess(true);
    },
    size: () => byCapability.size,
  });
}

export const defaultShadowNormalizerRegistry = createShadowNormalizerRegistry();

export function registerShadowNormalizer(registration) {
  return defaultShadowNormalizerRegistry.register(registration);
}

export function resolveShadowNormalizer(capability) {
  return defaultShadowNormalizerRegistry.resolve(capability);
}

export function getShadowNormalizerRegistration(capability) {
  const result = defaultShadowNormalizerRegistry.resolve(capability);
  return result.ok ? result.value : null;
}

export function listShadowNormalizerRegistrations() {
  return defaultShadowNormalizerRegistry.list();
}

export function isShadowNormalizerRegistryEmpty() {
  return defaultShadowNormalizerRegistry.isEmpty();
}

export function unregisterShadowNormalizer(capability) {
  return defaultShadowNormalizerRegistry.unregister(capability);
}

export function resetShadowNormalizerRegistryForTests() {
  if (defaultShadowNormalizerRegistry.isFrozen()) {
    throw new Error("cannot reset frozen shadow normalizer registry in tests");
  }
  defaultShadowNormalizerRegistry.clear();
}
