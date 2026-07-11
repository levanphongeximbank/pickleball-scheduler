import { readEnvBoolean } from "./envReader.js";

export const COMPETITION_CORE_FLAG_KEYS = Object.freeze({
  CORE: "VITE_COMPETITION_CORE_ENABLED",
  RATING_V2: "VITE_COMPETITION_CORE_RATING_V2_ENABLED",
  DRAW_V2: "VITE_COMPETITION_CORE_DRAW_V2_ENABLED",
  MATCHMAKING_V2: "VITE_COMPETITION_CORE_MATCHMAKING_V2_ENABLED",
  STANDINGS_V2: "VITE_COMPETITION_CORE_STANDINGS_V2_ENABLED",
});

/**
 * @typedef {Object} CompetitionCoreFeatureFlags
 * @property {boolean} coreEnabled
 * @property {boolean} ratingV2Enabled
 * @property {boolean} drawV2Enabled
 * @property {boolean} matchmakingV2Enabled
 * @property {boolean} standingsV2Enabled
 */

/**
 * @param {Record<string, unknown>|undefined|null} [envSource]
 * @returns {CompetitionCoreFeatureFlags}
 */
export function getCompetitionCoreFeatureFlags(envSource) {
  return {
    coreEnabled: readEnvBoolean(COMPETITION_CORE_FLAG_KEYS.CORE, envSource),
    ratingV2Enabled: readEnvBoolean(COMPETITION_CORE_FLAG_KEYS.RATING_V2, envSource),
    drawV2Enabled: readEnvBoolean(COMPETITION_CORE_FLAG_KEYS.DRAW_V2, envSource),
    matchmakingV2Enabled: readEnvBoolean(
      COMPETITION_CORE_FLAG_KEYS.MATCHMAKING_V2,
      envSource
    ),
    standingsV2Enabled: readEnvBoolean(COMPETITION_CORE_FLAG_KEYS.STANDINGS_V2, envSource),
  };
}

/** Master gate — sub-flags require core enabled in CC-01. */
export function isCompetitionCoreEnabled(envSource) {
  return getCompetitionCoreFeatureFlags(envSource).coreEnabled;
}

export function isRatingV2Enabled(envSource) {
  const flags = getCompetitionCoreFeatureFlags(envSource);
  return flags.coreEnabled && flags.ratingV2Enabled;
}

export function isDrawV2Enabled(envSource) {
  const flags = getCompetitionCoreFeatureFlags(envSource);
  return flags.coreEnabled && flags.drawV2Enabled;
}

export function isMatchmakingV2Enabled(envSource) {
  const flags = getCompetitionCoreFeatureFlags(envSource);
  return flags.coreEnabled && flags.matchmakingV2Enabled;
}

export function isStandingsV2Enabled(envSource) {
  const flags = getCompetitionCoreFeatureFlags(envSource);
  return flags.coreEnabled && flags.standingsV2Enabled;
}
