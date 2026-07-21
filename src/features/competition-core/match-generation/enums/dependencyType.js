/**
 * CORE-09 — explicit MatchDependency types.
 */

export const MATCH_DEPENDENCY_TYPE = Object.freeze({
  WINNER_OF: "WINNER_OF",
  LOSER_OF: "LOSER_OF",
  DRAW_PLACEMENT: "DRAW_PLACEMENT",
  DIRECT_PARTICIPANT: "DIRECT_PARTICIPANT",
  BYE: "BYE",
});

/** @type {ReadonlySet<string>} */
export const MATCH_DEPENDENCY_TYPE_VALUES = new Set(
  Object.values(MATCH_DEPENDENCY_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMatchDependencyType(value) {
  return typeof value === "string" && MATCH_DEPENDENCY_TYPE_VALUES.has(value);
}
