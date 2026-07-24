/**
 * Canonical competition types owned by CM-01 (management header).
 * Values align with legacy TOURNAMENT_MODE string values for adapter mapping,
 * but CM-01 does not silently default or repair unknown modes.
 */

export const COMPETITION_TYPE = Object.freeze({
  DAILY_PLAY: "daily_play",
  INTERNAL_TOURNAMENT: "internal_tournament",
  OFFICIAL_TOURNAMENT: "official_tournament",
  TEAM_TOURNAMENT: "team_tournament",
});

export const COMPETITION_TYPE_VALUES = Object.freeze(
  Object.values(COMPETITION_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionType(value) {
  return (
    typeof value === "string" &&
    COMPETITION_TYPE_VALUES.includes(value)
  );
}
