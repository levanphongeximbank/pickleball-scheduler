/**
 * CORE-16 — deterministic scoring domain event types.
 */

export const SCORING_EVENT_TYPE = Object.freeze({
  POINT_RECORDED: "POINT_RECORDED",
  POINT_DENIED_NO_SCORE: "POINT_DENIED_NO_SCORE",
  SERVE_CHANGED: "SERVE_CHANGED",
  SERVER_NUMBER_CHANGED: "SERVER_NUMBER_CHANGED",
  GAME_COMPLETED: "GAME_COMPLETED",
  SET_COMPLETED: "SET_COMPLETED",
  MATCH_COMPLETED: "MATCH_COMPLETED",
  EVENT_SUPERSEDED: "EVENT_SUPERSEDED",
});

/** @type {ReadonlySet<string>} */
export const SCORING_EVENT_TYPE_VALUES = new Set(
  Object.values(SCORING_EVENT_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isScoringEventType(value) {
  return typeof value === "string" && SCORING_EVENT_TYPE_VALUES.has(value);
}
