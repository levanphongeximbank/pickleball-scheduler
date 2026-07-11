/** @typedef {import('../types/constraintSeverity.js').ConstraintSeverityValue} ConstraintSeverityValue */

export const CONSTRAINT_SEVERITY = Object.freeze({
  HARD: "hard",
  SOFT: "soft",
});

/** @type {ReadonlySet<ConstraintSeverityValue>} */
export const CONSTRAINT_SEVERITY_VALUES = new Set(Object.values(CONSTRAINT_SEVERITY));

/**
 * @param {unknown} value
 * @returns {value is ConstraintSeverityValue}
 */
export function isConstraintSeverity(value) {
  return (
    typeof value === "string" &&
    CONSTRAINT_SEVERITY_VALUES.has(/** @type {ConstraintSeverityValue} */ (value))
  );
}
