/**
 * CORE-14 — activity identity type for LogicalAssignmentKeyV1.
 */

export const ACTIVITY_IDENTITY_TYPE = Object.freeze({
  ASSIGNMENT_ID: "ASSIGNMENT_ID",
  ACTIVITY_ID: "ACTIVITY_ID",
  MATCH_ID: "MATCH_ID",
});

export const ACTIVITY_IDENTITY_TYPE_VALUES = Object.freeze([
  ACTIVITY_IDENTITY_TYPE.ASSIGNMENT_ID,
  ACTIVITY_IDENTITY_TYPE.ACTIVITY_ID,
  ACTIVITY_IDENTITY_TYPE.MATCH_ID,
]);

const ACTIVITY_IDENTITY_TYPE_SET = new Set(ACTIVITY_IDENTITY_TYPE_VALUES);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isActivityIdentityType(value) {
  return typeof value === "string" && ACTIVITY_IDENTITY_TYPE_SET.has(value);
}
