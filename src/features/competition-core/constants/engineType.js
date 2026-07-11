/** @typedef {import('../types/engineType.js').CompetitionEngineTypeValue} CompetitionEngineTypeValue */

export const COMPETITION_ENGINE_TYPE = Object.freeze({
  DRAW: "draw",
  TEAM_FORMATION: "team_formation",
  MATCHMAKING: "matchmaking",
  SCHEDULING: "scheduling",
  STANDINGS: "standings",
  RATING: "rating",
});

/** @type {ReadonlySet<CompetitionEngineTypeValue>} */
export const COMPETITION_ENGINE_TYPE_VALUES = new Set(Object.values(COMPETITION_ENGINE_TYPE));

/**
 * @param {unknown} value
 * @returns {value is CompetitionEngineTypeValue}
 */
export function isCompetitionEngineType(value) {
  return (
    typeof value === "string" &&
    COMPETITION_ENGINE_TYPE_VALUES.has(/** @type {CompetitionEngineTypeValue} */ (value))
  );
}
