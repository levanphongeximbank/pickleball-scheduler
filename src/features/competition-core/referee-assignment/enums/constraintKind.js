export const REFEREE_CONSTRAINT_KIND = Object.freeze({
  HARD: "HARD",
  SOFT: "SOFT",
});

/** @type {ReadonlySet<string>} */
export const REFEREE_CONSTRAINT_KIND_VALUES = new Set(
  Object.values(REFEREE_CONSTRAINT_KIND)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRefereeConstraintKind(value) {
  return typeof value === "string" && REFEREE_CONSTRAINT_KIND_VALUES.has(value);
}
