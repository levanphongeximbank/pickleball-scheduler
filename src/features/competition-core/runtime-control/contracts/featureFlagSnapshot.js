/**
 * Feature flag snapshot — pure data input (Phase 3A.1).
 * No env loading, no remote config.
 */

import { isPlainObject, cloneJsonSafe } from "./jsonSafe.js";
import { isRuntimeMode, RUNTIME_MODE } from "./runtimeModes.js";

/**
 * @typedef {Object} FeatureFlagSnapshot
 * @property {{ enabled: boolean, killSwitch: boolean }} global
 * @property {Record<string, boolean>} capabilities
 * @property {Record<string, boolean>} formats
 * @property {Record<string, { enabled?: boolean, killSwitch?: boolean }>} tenants
 * @property {Record<string, { enabled?: boolean, killSwitch?: boolean, runtimeMode?: string }>} competitions
 * @property {{ enabled: boolean, samplingRate: number }} shadow
 * @property {{ active: boolean, targetMode?: string|null, reason?: string|null }|null} rollback
 */

/**
 * @returns {FeatureFlagSnapshot}
 */
export function createDefaultFeatureFlagSnapshot() {
  return {
    global: {
      enabled: false,
      killSwitch: false,
    },
    capabilities: {},
    formats: {},
    tenants: {},
    competitions: {},
    shadow: {
      enabled: false,
      samplingRate: 0,
    },
    rollback: null,
  };
}

/**
 * @param {Partial<FeatureFlagSnapshot>|null|undefined} partial
 * @returns {FeatureFlagSnapshot}
 */
export function createFeatureFlagSnapshot(partial = {}) {
  const globalIn = isPlainObject(partial?.global) ? partial.global : {};
  const shadowIn = isPlainObject(partial?.shadow) ? partial.shadow : {};
  const rollbackIn = isPlainObject(partial?.rollback) ? partial.rollback : null;

  return {
    global: {
      enabled: Boolean(globalIn.enabled),
      killSwitch: Boolean(globalIn.killSwitch),
    },
    capabilities: isPlainObject(partial?.capabilities)
      ? cloneJsonSafe(partial.capabilities)
      : {},
    formats: isPlainObject(partial?.formats) ? cloneJsonSafe(partial.formats) : {},
    tenants: isPlainObject(partial?.tenants) ? cloneJsonSafe(partial.tenants) : {},
    competitions: isPlainObject(partial?.competitions)
      ? cloneJsonSafe(partial.competitions)
      : {},
    shadow: {
      enabled: Boolean(shadowIn.enabled),
      samplingRate:
        typeof shadowIn.samplingRate === "number" && Number.isFinite(shadowIn.samplingRate)
          ? shadowIn.samplingRate
          : 0,
    },
    rollback: rollbackIn
      ? {
          active: Boolean(rollbackIn.active),
          targetMode: isRuntimeMode(rollbackIn.targetMode)
            ? rollbackIn.targetMode
            : RUNTIME_MODE.LEGACY_ONLY,
          reason: typeof rollbackIn.reason === "string" ? rollbackIn.reason : null,
        }
      : null,
  };
}
