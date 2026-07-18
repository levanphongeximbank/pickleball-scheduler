/**
 * Audit event contract — object only, no persistence (Phase 3A.1).
 */

import { isPlainObject, cloneJsonSafe } from "./jsonSafe.js";

export const RUNTIME_AUDIT_EVENT_TYPE = Object.freeze({
  RUNTIME_DECISION: "RUNTIME_DECISION",
});

/**
 * @typedef {Object} RuntimeAuditEvent
 * @property {string} eventType
 * @property {string} requestId
 * @property {string|null} tenantId
 * @property {string|null} competitionId
 * @property {string|null} capability
 * @property {string|null} format
 * @property {string} selectedMode
 * @property {string} reasonCode
 * @property {string} evaluatedAt
 * @property {string|null} actorId
 * @property {string} runtimeVersion
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {Partial<RuntimeAuditEvent>|null|undefined} partial
 * @returns {RuntimeAuditEvent}
 */
export function createRuntimeAuditEvent(partial = {}) {
  return {
    eventType:
      typeof partial?.eventType === "string"
        ? partial.eventType
        : RUNTIME_AUDIT_EVENT_TYPE.RUNTIME_DECISION,
    requestId: typeof partial?.requestId === "string" ? partial.requestId : "",
    tenantId: typeof partial?.tenantId === "string" ? partial.tenantId : null,
    competitionId:
      typeof partial?.competitionId === "string" ? partial.competitionId : null,
    capability: typeof partial?.capability === "string" ? partial.capability : null,
    format: typeof partial?.format === "string" ? partial.format : null,
    selectedMode: typeof partial?.selectedMode === "string" ? partial.selectedMode : "",
    reasonCode: typeof partial?.reasonCode === "string" ? partial.reasonCode : "",
    evaluatedAt: typeof partial?.evaluatedAt === "string" ? partial.evaluatedAt : "",
    actorId: typeof partial?.actorId === "string" ? partial.actorId : null,
    runtimeVersion:
      typeof partial?.runtimeVersion === "string" ? partial.runtimeVersion : "",
    metadata: isPlainObject(partial?.metadata) ? cloneJsonSafe(partial.metadata) : {},
  };
}
