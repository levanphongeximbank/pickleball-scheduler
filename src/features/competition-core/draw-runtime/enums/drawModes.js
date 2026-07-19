/** Phase 3H — canonical draw modes.
 *
 * HYBRID is retained in the enum for Integrator-owned composition packs.
 * Draw Runtime Core does not execute HYBRID (returns DRAW_UNSUPPORTED_MODE).
 */

export const DRAW_MODE = Object.freeze({
  SEEDED_GROUPS: "SEEDED_GROUPS",
  OPEN_RANDOM_GROUPS: "OPEN_RANDOM_GROUPS",
  SNAKE_GROUPS: "SNAKE_GROUPS",
  SERPENTINE_GROUPS: "SERPENTINE_GROUPS",
  POT_GROUPS: "POT_GROUPS",
  SEEDED_BRACKET: "SEEDED_BRACKET",
  OPEN_RANDOM_BRACKET: "OPEN_RANDOM_BRACKET",
  MANUAL_PLACEMENT: "MANUAL_PLACEMENT",
  /** Integrator-owned — not executable in Core. */
  HYBRID: "HYBRID",
  NOOP: "NOOP",
});

/** @type {ReadonlySet<string>} */
export const DRAW_MODE_VALUES = new Set(Object.values(DRAW_MODE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDrawMode(value) {
  return typeof value === "string" && DRAW_MODE_VALUES.has(value);
}

export const GROUP_DRAW_MODES = Object.freeze([
  DRAW_MODE.SEEDED_GROUPS,
  DRAW_MODE.OPEN_RANDOM_GROUPS,
  DRAW_MODE.SNAKE_GROUPS,
  DRAW_MODE.SERPENTINE_GROUPS,
  DRAW_MODE.POT_GROUPS,
]);

export const BRACKET_DRAW_MODES = Object.freeze([
  DRAW_MODE.SEEDED_BRACKET,
  DRAW_MODE.OPEN_RANDOM_BRACKET,
]);
