/**
 * CORE-16 — canonical scoring sides (not match participant identity).
 */

export const SCORING_SIDE = Object.freeze({
  SIDE_A: "SIDE_A",
  SIDE_B: "SIDE_B",
});

/** @type {ReadonlySet<string>} */
export const SCORING_SIDE_VALUES = new Set(Object.values(SCORING_SIDE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isScoringSide(value) {
  return typeof value === "string" && SCORING_SIDE_VALUES.has(value);
}

/**
 * @param {string} side
 * @returns {string}
 */
export function oppositeScoringSide(side) {
  return side === SCORING_SIDE.SIDE_A
    ? SCORING_SIDE.SIDE_B
    : SCORING_SIDE.SIDE_A;
}
