/**
 * CORE-16 — scoring systems owned by the scoring format.
 */

export const SCORING_SYSTEM = Object.freeze({
  RALLY: "RALLY",
  SIDE_OUT: "SIDE_OUT",
});

/** @type {ReadonlySet<string>} */
export const SCORING_SYSTEM_VALUES = new Set(Object.values(SCORING_SYSTEM));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isScoringSystem(value) {
  return typeof value === "string" && SCORING_SYSTEM_VALUES.has(value);
}
