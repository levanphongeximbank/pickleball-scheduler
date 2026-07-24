/**
 * CM-06 readiness/legacy-projection issue severity.
 */

export const COMPETITION_PUBLICATION_SEVERITY = Object.freeze({
  ERROR: "ERROR",
  WARNING: "WARNING",
  INFO: "INFO",
});

export const COMPETITION_PUBLICATION_SEVERITY_VALUES = Object.freeze(
  Object.values(COMPETITION_PUBLICATION_SEVERITY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionPublicationSeverity(value) {
  return (
    typeof value === "string" &&
    COMPETITION_PUBLICATION_SEVERITY_VALUES.includes(value)
  );
}
