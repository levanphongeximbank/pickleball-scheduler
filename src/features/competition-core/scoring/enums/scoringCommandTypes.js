/**
 * CORE-16 — scoring commands.
 */

export const SCORING_COMMAND_TYPE = Object.freeze({
  RECORD_POINT: "RECORD_POINT",
  SUPERSEDE_EVENT: "SUPERSEDE_EVENT",
  REPLAY_PROJECTION: "REPLAY_PROJECTION",
});

/** @type {ReadonlySet<string>} */
export const SCORING_COMMAND_TYPE_VALUES = new Set(
  Object.values(SCORING_COMMAND_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isScoringCommandType(value) {
  return typeof value === "string" && SCORING_COMMAND_TYPE_VALUES.has(value);
}
