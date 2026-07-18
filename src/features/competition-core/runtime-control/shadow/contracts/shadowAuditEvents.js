/**
 * Shadow audit-event factories (Phase 3A.2).
 * Pure objects only — no persist / publish / API.
 */

import { cloneJsonSafe, isPlainObject } from "../../contracts/jsonSafe.js";
import { SHADOW_AUDIT_EVENT_TYPE } from "../constants/shadowAuditEventTypes.js";
import { SHADOW_INFRASTRUCTURE_VERSION } from "../constants/shadowExecutors.js";

/**
 * @typedef {Object} ShadowAuditEvent
 * @property {string} eventType
 * @property {string} correlationId
 * @property {string|null} competitionId
 * @property {string|null} capability
 * @property {string|null} operation
 * @property {string} reasonCode
 * @property {string} evaluatedAt
 * @property {string} shadowVersion
 * @property {Record<string, unknown>} payload
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {Partial<ShadowAuditEvent>|null|undefined} partial
 * @returns {ShadowAuditEvent}
 */
export function createShadowAuditEvent(partial = {}) {
  const eventType =
    typeof partial?.eventType === "string" && partial.eventType
      ? partial.eventType
      : SHADOW_AUDIT_EVENT_TYPE.SHADOW_ELIGIBILITY_EVALUATED;

  return {
    eventType,
    correlationId:
      typeof partial?.correlationId === "string" ? partial.correlationId : "",
    competitionId:
      typeof partial?.competitionId === "string" ? partial.competitionId : null,
    capability: typeof partial?.capability === "string" ? partial.capability : null,
    operation: typeof partial?.operation === "string" ? partial.operation : null,
    reasonCode: typeof partial?.reasonCode === "string" ? partial.reasonCode : "",
    evaluatedAt: typeof partial?.evaluatedAt === "string" ? partial.evaluatedAt : "",
    shadowVersion:
      typeof partial?.shadowVersion === "string" && partial.shadowVersion
        ? partial.shadowVersion
        : SHADOW_INFRASTRUCTURE_VERSION,
    payload: isPlainObject(partial?.payload) ? cloneJsonSafe(partial.payload) : {},
    metadata: isPlainObject(partial?.metadata)
      ? cloneJsonSafe(partial.metadata)
      : {},
  };
}

/**
 * @param {object} input
 * @returns {ShadowAuditEvent}
 */
export function createShadowEligibilityEvaluatedEvent(input = {}) {
  return createShadowAuditEvent({
    ...input,
    eventType: SHADOW_AUDIT_EVENT_TYPE.SHADOW_ELIGIBILITY_EVALUATED,
  });
}

/**
 * @param {object} input
 * @returns {ShadowAuditEvent}
 */
export function createShadowPlanCreatedEvent(input = {}) {
  return createShadowAuditEvent({
    ...input,
    eventType: SHADOW_AUDIT_EVENT_TYPE.SHADOW_PLAN_CREATED,
  });
}

/**
 * @param {object} input
 * @returns {ShadowAuditEvent}
 */
export function createShadowExecutionSkippedEvent(input = {}) {
  return createShadowAuditEvent({
    ...input,
    eventType: SHADOW_AUDIT_EVENT_TYPE.SHADOW_EXECUTION_SKIPPED,
  });
}

/**
 * @param {object} input
 * @returns {ShadowAuditEvent}
 */
export function createShadowComparisonCompletedEvent(input = {}) {
  return createShadowAuditEvent({
    ...input,
    eventType: SHADOW_AUDIT_EVENT_TYPE.SHADOW_COMPARISON_COMPLETED,
  });
}

/**
 * @param {object} input
 * @returns {ShadowAuditEvent}
 */
export function createShadowDivergenceDetectedEvent(input = {}) {
  return createShadowAuditEvent({
    ...input,
    eventType: SHADOW_AUDIT_EVENT_TYPE.SHADOW_DIVERGENCE_DETECTED,
  });
}
