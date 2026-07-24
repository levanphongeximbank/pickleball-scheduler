/**
 * Severity for legacy observation issues (CM-07).
 */

export const COMPETITION_LIFECYCLE_SEVERITY = Object.freeze({
  INFO: "INFO",
  WARNING: "WARNING",
  ERROR: "ERROR",
});

export const COMPETITION_LIFECYCLE_SEVERITY_VALUES = Object.freeze(
  Object.values(COMPETITION_LIFECYCLE_SEVERITY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionLifecycleSeverity(value) {
  return (
    typeof value === "string" &&
    COMPETITION_LIFECYCLE_SEVERITY_VALUES.includes(value)
  );
}
