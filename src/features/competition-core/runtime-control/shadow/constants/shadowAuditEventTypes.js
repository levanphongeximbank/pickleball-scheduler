/**
 * Shadow audit-event type constants (Phase 3A.2).
 * Factories only — no persistence / publish.
 */

export const SHADOW_AUDIT_EVENT_TYPE = Object.freeze({
  SHADOW_ELIGIBILITY_EVALUATED: "SHADOW_ELIGIBILITY_EVALUATED",
  SHADOW_PLAN_CREATED: "SHADOW_PLAN_CREATED",
  SHADOW_EXECUTION_SKIPPED: "SHADOW_EXECUTION_SKIPPED",
  SHADOW_COMPARISON_COMPLETED: "SHADOW_COMPARISON_COMPLETED",
  SHADOW_DIVERGENCE_DETECTED: "SHADOW_DIVERGENCE_DETECTED",
});

export const SHADOW_AUDIT_EVENT_TYPE_VALUES = Object.freeze(
  Object.values(SHADOW_AUDIT_EVENT_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isShadowAuditEventType(value) {
  return SHADOW_AUDIT_EVENT_TYPE_VALUES.includes(value);
}
