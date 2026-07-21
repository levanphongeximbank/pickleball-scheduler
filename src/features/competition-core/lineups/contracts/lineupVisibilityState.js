/**
 * CORE-06 Phase 1E — canonical lineup visibility states (monotonic by default).
 * Lifecycle status alone never implies opponent/public reveal.
 */

export const LINEUP_VISIBILITY_STATE = Object.freeze({
  PRIVATE: "PRIVATE",
  TEAM_VISIBLE: "TEAM_VISIBLE",
  OFFICIALS_VISIBLE: "OFFICIALS_VISIBLE",
  OPPONENT_VISIBLE: "OPPONENT_VISIBLE",
  PUBLIC: "PUBLIC",
});

/** @type {ReadonlySet<string>} */
export const LINEUP_VISIBILITY_STATE_VALUES = new Set(
  Object.values(LINEUP_VISIBILITY_STATE)
);

/** Monotonic rank — higher means more visible. */
export const LINEUP_VISIBILITY_RANK = Object.freeze({
  [LINEUP_VISIBILITY_STATE.PRIVATE]: 0,
  [LINEUP_VISIBILITY_STATE.TEAM_VISIBLE]: 1,
  [LINEUP_VISIBILITY_STATE.OFFICIALS_VISIBLE]: 2,
  [LINEUP_VISIBILITY_STATE.OPPONENT_VISIBLE]: 3,
  [LINEUP_VISIBILITY_STATE.PUBLIC]: 4,
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLineupVisibilityState(value) {
  return (
    typeof value === "string" && LINEUP_VISIBILITY_STATE_VALUES.has(value)
  );
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeLineupVisibilityState(value) {
  if (!isLineupVisibilityState(value)) return null;
  return /** @type {string} */ (value);
}

/**
 * Default rank comparison. Unknown states are not comparable (fail closed).
 * @param {string} from
 * @param {string} to
 * @returns {number|null} positive = widen, 0 = same, negative = regress, null = unknown
 */
export function compareVisibilityRank(from, to) {
  const a = LINEUP_VISIBILITY_RANK[from];
  const b = LINEUP_VISIBILITY_RANK[to];
  if (typeof a !== "number" || typeof b !== "number") return null;
  return b - a;
}
