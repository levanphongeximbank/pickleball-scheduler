/** Phase 3G — why a seed number was assigned. */

export const ASSIGNMENT_REASON = Object.freeze({
  MANUAL_LOCKED: "MANUAL_LOCKED",
  PROTECTED_SEED: "PROTECTED_SEED",
  RANKING_ORDER: "RANKING_ORDER",
  RATING_ORDER: "RATING_ORDER",
  SOURCE_PRIORITY: "SOURCE_PRIORITY",
  IDENTITY_ORDER: "IDENTITY_ORDER",
  DETERMINISTIC_RANDOM: "DETERMINISTIC_RANDOM",
  PARTIAL_AUTO_FILL: "PARTIAL_AUTO_FILL",
  POLICY: "POLICY",
});

/** @type {ReadonlySet<string>} */
export const ASSIGNMENT_REASON_VALUES = new Set(
  Object.values(ASSIGNMENT_REASON)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isAssignmentReason(value) {
  return typeof value === "string" && ASSIGNMENT_REASON_VALUES.has(value);
}
