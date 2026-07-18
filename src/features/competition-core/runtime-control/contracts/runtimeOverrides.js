/**
 * Runtime override contract — pure data (Phase 3A.1).
 * No persistence / UI.
 */

import { isRuntimeScope } from "../constants/runtimeScopes.js";
import { isRuntimeCapability, isRuntimeFormat } from "../constants/runtimeScopes.js";
import { isRuntimeMode } from "./runtimeModes.js";
import { isPlainObject } from "./jsonSafe.js";

/**
 * @typedef {Object} RuntimeOverride
 * @property {string} scope
 * @property {string|null} scopeId
 * @property {string|null} capability
 * @property {string|null} format
 * @property {boolean|null} enabled
 * @property {string|null} runtimeMode
 * @property {boolean} killSwitch
 * @property {string|null} reason
 * @property {string|null} approvedBy
 * @property {string|null} approvedAt
 * @property {string|null} expiresAt
 */

/**
 * @param {Partial<RuntimeOverride>|null|undefined} partial
 * @returns {RuntimeOverride}
 */
export function createRuntimeOverride(partial = {}) {
  return {
    scope: typeof partial?.scope === "string" ? partial.scope : "",
    scopeId: typeof partial?.scopeId === "string" ? partial.scopeId : null,
    capability: typeof partial?.capability === "string" ? partial.capability : null,
    format: typeof partial?.format === "string" ? partial.format : null,
    enabled: typeof partial?.enabled === "boolean" ? partial.enabled : null,
    runtimeMode: isRuntimeMode(partial?.runtimeMode) ? partial.runtimeMode : null,
    killSwitch: Boolean(partial?.killSwitch),
    reason: typeof partial?.reason === "string" ? partial.reason : null,
    approvedBy: typeof partial?.approvedBy === "string" ? partial.approvedBy : null,
    approvedAt: typeof partial?.approvedAt === "string" ? partial.approvedAt : null,
    expiresAt: typeof partial?.expiresAt === "string" ? partial.expiresAt : null,
  };
}

/**
 * @param {unknown} override
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function assertRuntimeOverrideShape(override) {
  const errors = [];
  if (!isPlainObject(override)) {
    return { ok: false, errors: ["override must be an object"] };
  }
  if (!isRuntimeScope(override.scope)) {
    errors.push("scope must be a known RUNTIME_SCOPE");
  }
  if (override.capability != null && !isRuntimeCapability(override.capability)) {
    errors.push("capability must be a known RUNTIME_CAPABILITY when set");
  }
  if (override.format != null && !isRuntimeFormat(override.format)) {
    errors.push("format must be a known RUNTIME_FORMAT when set");
  }
  if (override.runtimeMode != null && !isRuntimeMode(override.runtimeMode)) {
    errors.push("runtimeMode must be a known RUNTIME_MODE when set");
  }
  return { ok: errors.length === 0, errors };
}
