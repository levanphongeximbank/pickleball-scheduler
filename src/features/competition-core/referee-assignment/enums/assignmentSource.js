export const REFEREE_ASSIGNMENT_SOURCE = Object.freeze({
  AUTO: "AUTO",
  MANUAL: "MANUAL",
  REPLACEMENT: "REPLACEMENT",
});

/** @type {ReadonlySet<string>} */
export const REFEREE_ASSIGNMENT_SOURCE_VALUES = new Set(
  Object.values(REFEREE_ASSIGNMENT_SOURCE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRefereeAssignmentSource(value) {
  return (
    typeof value === "string" && REFEREE_ASSIGNMENT_SOURCE_VALUES.has(value)
  );
}
