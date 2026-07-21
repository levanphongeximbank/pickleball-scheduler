/**
 * CORE-09 — MatchGenerationIssue severity.
 */

export const MATCH_GENERATION_ISSUE_SEVERITY = Object.freeze({
  ERROR: "ERROR",
  WARNING: "WARNING",
  INFO: "INFO",
});

/** @type {ReadonlySet<string>} */
export const MATCH_GENERATION_ISSUE_SEVERITY_VALUES = new Set(
  Object.values(MATCH_GENERATION_ISSUE_SEVERITY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMatchGenerationIssueSeverity(value) {
  return (
    typeof value === "string" &&
    MATCH_GENERATION_ISSUE_SEVERITY_VALUES.has(value)
  );
}
