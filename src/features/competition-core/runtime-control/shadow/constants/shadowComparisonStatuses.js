/**
 * Shadow comparison statuses (Phase 3A.2).
 * Not a boolean — supports partial / error / skipped outcomes.
 */

export const SHADOW_COMPARISON_STATUS = Object.freeze({
  EQUIVALENT: "EQUIVALENT",
  NON_EQUIVALENT: "NON_EQUIVALENT",
  NOT_COMPARABLE: "NOT_COMPARABLE",
  PARTIAL: "PARTIAL",
  ERROR: "ERROR",
  SKIPPED: "SKIPPED",
});

export const SHADOW_COMPARISON_STATUS_VALUES = Object.freeze(
  Object.values(SHADOW_COMPARISON_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isShadowComparisonStatus(value) {
  return SHADOW_COMPARISON_STATUS_VALUES.includes(value);
}
