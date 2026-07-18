/**
 * Structured difference kinds for shadow comparison (Phase 3A.2).
 */

export const SHADOW_DIFFERENCE_KIND = Object.freeze({
  MISSING_IN_LEGACY: "MISSING_IN_LEGACY",
  MISSING_IN_CANONICAL: "MISSING_IN_CANONICAL",
  VALUE_MISMATCH: "VALUE_MISMATCH",
  TYPE_MISMATCH: "TYPE_MISMATCH",
  ORDER_MISMATCH: "ORDER_MISMATCH",
  ERROR_MISMATCH: "ERROR_MISMATCH",
});

export const SHADOW_DIFFERENCE_KIND_VALUES = Object.freeze(
  Object.values(SHADOW_DIFFERENCE_KIND)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isShadowDifferenceKind(value) {
  return SHADOW_DIFFERENCE_KIND_VALUES.includes(value);
}

export const SHADOW_DIFFERENCE_SEVERITY = Object.freeze({
  INFO: "INFO",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
});

export const SHADOW_DIFFERENCE_SEVERITY_VALUES = Object.freeze(
  Object.values(SHADOW_DIFFERENCE_SEVERITY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isShadowDifferenceSeverity(value) {
  return SHADOW_DIFFERENCE_SEVERITY_VALUES.includes(value);
}

/** Numeric rank for summarizer (higher = worse). */
export const SHADOW_SEVERITY_RANK = Object.freeze({
  [SHADOW_DIFFERENCE_SEVERITY.INFO]: 0,
  [SHADOW_DIFFERENCE_SEVERITY.LOW]: 1,
  [SHADOW_DIFFERENCE_SEVERITY.MEDIUM]: 2,
  [SHADOW_DIFFERENCE_SEVERITY.HIGH]: 3,
  [SHADOW_DIFFERENCE_SEVERITY.CRITICAL]: 4,
});
