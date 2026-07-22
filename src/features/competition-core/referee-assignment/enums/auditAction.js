export const REFEREE_AUDIT_ACTION = Object.freeze({
  ASSIGNED: "ASSIGNED",
  MANUAL_ASSIGNED: "MANUAL_ASSIGNED",
  REPLACED: "REPLACED",
  RELEASED: "RELEASED",
  REJECTED: "REJECTED",
  PLAN_GENERATED: "PLAN_GENERATED",
});

/** @type {ReadonlySet<string>} */
export const REFEREE_AUDIT_ACTION_VALUES = new Set(
  Object.values(REFEREE_AUDIT_ACTION)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRefereeAuditAction(value) {
  return typeof value === "string" && REFEREE_AUDIT_ACTION_VALUES.has(value);
}
