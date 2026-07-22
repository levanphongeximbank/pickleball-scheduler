export const REFEREE_ASSIGNMENT_STATUS = Object.freeze({
  PLANNED: "PLANNED",
  CONFIRMED: "CONFIRMED",
  REPLACED: "REPLACED",
  RELEASED: "RELEASED",
});

/** @type {ReadonlySet<string>} */
export const REFEREE_ASSIGNMENT_STATUS_VALUES = new Set(
  Object.values(REFEREE_ASSIGNMENT_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRefereeAssignmentStatus(value) {
  return (
    typeof value === "string" && REFEREE_ASSIGNMENT_STATUS_VALUES.has(value)
  );
}
