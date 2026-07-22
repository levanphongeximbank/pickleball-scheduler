export const REFEREE_CONFLICT_TYPE = Object.freeze({
  OVERLAP: "OVERLAP",
  CONFLICT_OF_INTEREST: "CONFLICT_OF_INTEREST",
  EXCLUSION: "EXCLUSION",
  CAPACITY: "CAPACITY",
  ROLE_UNSUPPORTED: "ROLE_UNSUPPORTED",
  UNAVAILABLE: "UNAVAILABLE",
  INACTIVE: "INACTIVE",
  NOT_QUALIFIED: "NOT_QUALIFIED",
});

/** @type {ReadonlySet<string>} */
export const REFEREE_CONFLICT_TYPE_VALUES = new Set(
  Object.values(REFEREE_CONFLICT_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRefereeConflictType(value) {
  return typeof value === "string" && REFEREE_CONFLICT_TYPE_VALUES.has(value);
}
