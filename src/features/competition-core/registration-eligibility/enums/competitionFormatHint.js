/**
 * Core-03 — opaque format hints for policy/context only.
 * Do not hard-code Team Tournament (or any format) rules into generic domain logic.
 */

export const COMPETITION_FORMAT_HINT = Object.freeze({
  DAILY_PLAY: "DAILY_PLAY",
  TEAM_TOURNAMENT: "TEAM_TOURNAMENT",
  INDIVIDUAL_TOURNAMENT: "INDIVIDUAL_TOURNAMENT",
  LEAGUE: "LEAGUE",
  LADDER: "LADDER",
  UNSPECIFIED: "UNSPECIFIED",
});

/** @type {ReadonlySet<string>} */
export const COMPETITION_FORMAT_HINT_VALUES = new Set(
  Object.values(COMPETITION_FORMAT_HINT)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionFormatHint(value) {
  return typeof value === "string" && COMPETITION_FORMAT_HINT_VALUES.has(value);
}
