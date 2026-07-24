/**
 * Severity for legacy observation / eligibility issues (CM-08).
 */

export const COMPETITION_ARCHIVE_SEVERITY = Object.freeze({
  ERROR: "ERROR",
  WARNING: "WARNING",
  INFO: "INFO",
});

export const COMPETITION_ARCHIVE_SEVERITY_VALUES = Object.freeze(
  Object.values(COMPETITION_ARCHIVE_SEVERITY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionArchiveSeverity(value) {
  return (
    typeof value === "string" &&
    COMPETITION_ARCHIVE_SEVERITY_VALUES.includes(value)
  );
}
