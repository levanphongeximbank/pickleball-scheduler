/**
 * Execution context contract — injected clock/seed only (Phase 3A.1).
 */

import { RUNTIME_CONTROL_VERSION } from "../constants/runtimeScopes.js";
import { isRuntimeCapability, isRuntimeFormat } from "../constants/runtimeScopes.js";
import { RUNTIME_MODE, isRuntimeMode } from "./runtimeModes.js";
import { isNonEmptyString, isPlainObject, cloneJsonSafe } from "./jsonSafe.js";

/**
 * @typedef {Object} RuntimeActor
 * @property {string|null} actorId
 * @property {string[]} roles
 */

/**
 * @typedef {Object} ExecutionContext
 * @property {string} requestId
 * @property {string|null} tenantId
 * @property {string|null} competitionId
 * @property {string} capability
 * @property {string} format
 * @property {RuntimeActor} actor
 * @property {string} timezone
 * @property {string} now
 * @property {string|number|null} randomSeed
 * @property {string} runtimeMode
 * @property {string} runtimeVersion
 * @property {Record<string, string>} capabilityVersions
 * @property {Record<string, unknown>} configSnapshot
 */

/**
 * @param {Partial<ExecutionContext>|null|undefined} partial
 * @returns {ExecutionContext}
 */
export function createExecutionContext(partial = {}) {
  const actorIn = isPlainObject(partial?.actor) ? partial.actor : {};
  const roles = Array.isArray(actorIn.roles)
    ? actorIn.roles.filter((r) => typeof r === "string")
    : [];

  return {
    requestId: typeof partial?.requestId === "string" ? partial.requestId : "",
    tenantId: typeof partial?.tenantId === "string" ? partial.tenantId : null,
    competitionId:
      typeof partial?.competitionId === "string" ? partial.competitionId : null,
    capability: typeof partial?.capability === "string" ? partial.capability : "",
    format: typeof partial?.format === "string" ? partial.format : "",
    actor: {
      actorId: typeof actorIn.actorId === "string" ? actorIn.actorId : null,
      roles: [...roles],
    },
    timezone: typeof partial?.timezone === "string" ? partial.timezone : "UTC",
    now: typeof partial?.now === "string" ? partial.now : "",
    randomSeed:
      typeof partial?.randomSeed === "string" || typeof partial?.randomSeed === "number"
        ? partial.randomSeed
        : null,
    runtimeMode: isRuntimeMode(partial?.runtimeMode)
      ? partial.runtimeMode
      : RUNTIME_MODE.LEGACY_ONLY,
    runtimeVersion:
      typeof partial?.runtimeVersion === "string" && partial.runtimeVersion
        ? partial.runtimeVersion
        : RUNTIME_CONTROL_VERSION,
    capabilityVersions: isPlainObject(partial?.capabilityVersions)
      ? cloneJsonSafe(partial.capabilityVersions)
      : {},
    configSnapshot: isPlainObject(partial?.configSnapshot)
      ? cloneJsonSafe(partial.configSnapshot)
      : {},
  };
}

/**
 * @param {unknown} context
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function assertExecutionContextShape(context) {
  const errors = [];
  if (!isPlainObject(context)) {
    return { ok: false, errors: ["context must be an object"] };
  }
  if (!isNonEmptyString(context.requestId)) {
    errors.push("requestId is required");
  }
  if (!isRuntimeCapability(context.capability)) {
    errors.push("capability is required and must be a known RUNTIME_CAPABILITY");
  }
  if (!isRuntimeFormat(context.format)) {
    errors.push("format is required and must be a known RUNTIME_FORMAT");
  }
  if (!isNonEmptyString(context.now)) {
    errors.push("now must be injected (non-empty string)");
  }
  if (!isNonEmptyString(context.timezone)) {
    errors.push("timezone must be injected (non-empty string)");
  }
  if (!isRuntimeMode(context.runtimeMode)) {
    errors.push("runtimeMode is invalid");
  }
  if (!isPlainObject(context.actor)) {
    errors.push("actor must be an object");
  }
  return { ok: errors.length === 0, errors };
}
