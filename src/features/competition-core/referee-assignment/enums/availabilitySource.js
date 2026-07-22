export const REFEREE_AVAILABILITY_SOURCE = Object.freeze({
  DIRECTORY: "DIRECTORY",
  TOURNAMENT: "TOURNAMENT",
  MANUAL: "MANUAL",
  DERIVED: "DERIVED",
});

/** @type {ReadonlySet<string>} */
export const REFEREE_AVAILABILITY_SOURCE_VALUES = new Set(
  Object.values(REFEREE_AVAILABILITY_SOURCE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRefereeAvailabilitySource(value) {
  return (
    typeof value === "string" && REFEREE_AVAILABILITY_SOURCE_VALUES.has(value)
  );
}
