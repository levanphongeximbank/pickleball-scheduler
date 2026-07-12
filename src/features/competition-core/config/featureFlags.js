import { readEnvBoolean } from "./envReader.js";
import { resolveRulesV2Flag } from "./rulesV2FlagReader.js";

export const COMPETITION_CORE_FLAG_KEYS = Object.freeze({
  CORE: "VITE_COMPETITION_CORE_ENABLED",
  RATING_V2: "VITE_COMPETITION_CORE_RATING_V2_ENABLED",
  /** Canonical Rules V2 flag (CC-03B). */
  RULES_V2: "VITE_COMPETITION_CORE_RULES_V2_ENABLED",
  /** @deprecated Use RULES_V2 — backward-compatible alias reader only. */
  CONSTRAINTS_V2: "VITE_COMPETITION_CORE_CONSTRAINTS_V2_ENABLED",
  DRAW_V2: "VITE_COMPETITION_CORE_DRAW_V2_ENABLED",
  FORMATION_V2: "VITE_COMPETITION_CORE_FORMATION_V2_ENABLED",
  MATCHMAKING_V2: "VITE_COMPETITION_CORE_MATCHMAKING_V2_ENABLED",
  STANDINGS_V2: "VITE_COMPETITION_CORE_STANDINGS_V2_ENABLED",
});

/**
 * @typedef {Object} CompetitionCoreFeatureFlags
 * @property {boolean} coreEnabled
 * @property {boolean} ratingV2Enabled
 * @property {boolean} rulesV2Enabled
 * @property {boolean} constraintsV2Enabled
 * @property {boolean} drawV2Enabled
 * @property {boolean} formationV2Enabled
 * @property {boolean} matchmakingV2Enabled
 * @property {boolean} standingsV2Enabled
 * @property {'rules_v2'|'constraints_v2'|'default'} [rulesV2FlagSource]
 */

/**
 * @param {Record<string, unknown>|undefined|null} [envSource]
 * @returns {CompetitionCoreFeatureFlags}
 */
export function getCompetitionCoreFeatureFlags(envSource) {
  const rulesResolved = resolveRulesV2Flag(envSource);
  const rulesV2Enabled = rulesResolved.enabled;

  return {
    coreEnabled: readEnvBoolean(COMPETITION_CORE_FLAG_KEYS.CORE, envSource),
    ratingV2Enabled: readEnvBoolean(COMPETITION_CORE_FLAG_KEYS.RATING_V2, envSource),
    rulesV2Enabled,
    constraintsV2Enabled: rulesV2Enabled,
    drawV2Enabled: readEnvBoolean(COMPETITION_CORE_FLAG_KEYS.DRAW_V2, envSource),
    formationV2Enabled: readEnvBoolean(COMPETITION_CORE_FLAG_KEYS.FORMATION_V2, envSource),
    matchmakingV2Enabled: readEnvBoolean(
      COMPETITION_CORE_FLAG_KEYS.MATCHMAKING_V2,
      envSource
    ),
    standingsV2Enabled: readEnvBoolean(COMPETITION_CORE_FLAG_KEYS.STANDINGS_V2, envSource),
    rulesV2FlagSource: rulesResolved.source,
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

/** Canonical Rules V2 gate (CC-03B). */
export function isRulesV2Enabled(envSource) {
  const flags = getCompetitionCoreFeatureFlags(envSource);
  return flags.coreEnabled && flags.rulesV2Enabled;
}

/** @deprecated Alias for isRulesV2Enabled — kept for CC-03A callers. */
export function isConstraintsV2Enabled(envSource) {
  return isRulesV2Enabled(envSource);
}

export function isDrawV2Enabled(envSource) {
  const flags = getCompetitionCoreFeatureFlags(envSource);
  return flags.coreEnabled && flags.drawV2Enabled;
}

export function isFormationV2Enabled(envSource) {
  const flags = getCompetitionCoreFeatureFlags(envSource);
  return flags.coreEnabled && flags.formationV2Enabled;
}

export function isMatchmakingV2Enabled(envSource) {
  const flags = getCompetitionCoreFeatureFlags(envSource);
  return flags.coreEnabled && flags.matchmakingV2Enabled;
}

export function isStandingsV2Enabled(envSource) {
  const flags = getCompetitionCoreFeatureFlags(envSource);
  return flags.coreEnabled && flags.standingsV2Enabled;
}
