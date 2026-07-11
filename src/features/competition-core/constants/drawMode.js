/** @typedef {import('../types/drawMode.js').DrawModeValue} DrawModeValue */

export const DRAW_MODE = Object.freeze({
  PURE_RANDOM: "pure_random",
  CONSTRAINED_RANDOM: "constrained_random",
  SKILL_CONTROLLED: "skill_controlled",
  MANUAL: "manual",
});

/** @type {ReadonlySet<DrawModeValue>} */
export const DRAW_MODE_VALUES = new Set(Object.values(DRAW_MODE));

/**
 * @param {unknown} value
 * @returns {value is DrawModeValue}
 */
export function isDrawMode(value) {
  return typeof value === "string" && DRAW_MODE_VALUES.has(/** @type {DrawModeValue} */ (value));
}
