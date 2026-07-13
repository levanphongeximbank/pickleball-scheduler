import { COMPETITION_ENGINE_TYPE } from "../constants/engineType.js";
import {
  getCompetitionCoreFeatureFlags,
  isDrawV2Enabled,
  isFormationV2Enabled,
  isMatchmakingV2Enabled,
  isRatingV2Enabled,
  isRulesV2Enabled,
  isSchedulingV2Enabled,
  isStandingsV2Enabled,
} from "./featureFlags.js";

/** @typedef {'LEGACY'|'SHADOW'|'CANONICAL_TEST'|'CANONICAL_PRIMARY'} ExecutionModeValue */

export const EXECUTION_MODE = Object.freeze({
  LEGACY: "LEGACY",
  SHADOW: "SHADOW",
  CANONICAL_TEST: "CANONICAL_TEST",
  CANONICAL_PRIMARY: "CANONICAL_PRIMARY",
});

/** @type {ReadonlySet<string>} */
export const EXECUTION_MODE_VALUES = Object.freeze(
  new Set(Object.values(EXECUTION_MODE))
);

/**
 * @param {unknown} raw
 * @returns {ExecutionModeValue|null}
 */
export function normalizeExecutionMode(raw) {
  const key = String(raw || "").trim().toUpperCase();
  return EXECUTION_MODE_VALUES.has(key) ? /** @type {ExecutionModeValue} */ (key) : null;
}

/**
 * @param {import('../types/engineType.js').CompetitionEngineTypeValue} engineType
 * @param {Record<string, unknown>|undefined|null} [envSource]
 */
export function isModuleV2Enabled(engineType, envSource) {
  switch (engineType) {
    case COMPETITION_ENGINE_TYPE.RATING:
      return isRatingV2Enabled(envSource);
    case COMPETITION_ENGINE_TYPE.DRAW:
      return isDrawV2Enabled(envSource);
    case COMPETITION_ENGINE_TYPE.TEAM_FORMATION:
      return isFormationV2Enabled(envSource);
    case COMPETITION_ENGINE_TYPE.MATCHMAKING:
      return isMatchmakingV2Enabled(envSource);
    case COMPETITION_ENGINE_TYPE.STANDINGS:
      return isStandingsV2Enabled(envSource);
    case COMPETITION_ENGINE_TYPE.SCHEDULING:
      return isSchedulingV2Enabled(envSource);
    default:
      return isRulesV2Enabled(envSource);
  }
}

/**
 * Centralized Competition Core execution mode resolver (CC-10).
 *
 * Production defaults to LEGACY. CANONICAL_PRIMARY is blocked in production.
 * Unsupported modules always resolve LEGACY regardless of master flag.
 *
 * @param {Object} input
 * @param {import('../types/engineType.js').CompetitionEngineTypeValue} input.engineType
 * @param {Record<string, unknown>|undefined|null} [input.envSource]
 * @param {ExecutionModeValue|string|null} [input.requestedMode]
 * @param {boolean} [input.isProduction]
 * @param {boolean} [input.moduleSupported]
 */
export function resolveCompetitionCoreExecutionMode(input) {
  const flags = getCompetitionCoreFeatureFlags(input.envSource);
  const moduleEnabled = isModuleV2Enabled(input.engineType, input.envSource);
  const moduleSupported = input.moduleSupported !== false;
  const requested = normalizeExecutionMode(input.requestedMode);
  const isProduction = input.isProduction === true;

  if (!flags.coreEnabled || !moduleEnabled || !moduleSupported) {
    return {
      mode: EXECUTION_MODE.LEGACY,
      businessOutputOwner: "legacy",
      reason: !flags.coreEnabled
        ? "core_flag_off"
        : !moduleEnabled
          ? "module_flag_off"
          : "module_unsupported",
      limitations: [],
    };
  }

  if (isProduction) {
    return {
      mode: EXECUTION_MODE.LEGACY,
      businessOutputOwner: "legacy",
      reason: "production_legacy_only",
      limitations: ["canonical_primary_blocked_in_production"],
    };
  }

  if (requested === EXECUTION_MODE.CANONICAL_PRIMARY) {
    return {
      mode: EXECUTION_MODE.SHADOW,
      businessOutputOwner: "legacy",
      reason: "canonical_primary_downgraded_to_shadow",
      limitations: ["canonical_primary_not_enabled_in_cc10"],
    };
  }

  if (requested === EXECUTION_MODE.CANONICAL_TEST) {
    return {
      mode: EXECUTION_MODE.CANONICAL_TEST,
      businessOutputOwner: "canonical_test",
      reason: "isolated_fixture_test_mode",
      limitations: ["test_only_not_business_output"],
    };
  }

  return {
    mode: EXECUTION_MODE.SHADOW,
    businessOutputOwner: "legacy",
    reason: requested === EXECUTION_MODE.LEGACY ? "explicit_legacy_request_ignored_when_v2_on" : "default_shadow",
    limitations: [],
  };
}

/**
 * Map adapter-local executionMode strings to canonical EXECUTION_MODE.
 * @param {string} adapterMode
 * @param {boolean} [outputPreserved]
 */
export function mapAdapterExecutionMode(adapterMode, outputPreserved = true) {
  const normalized = String(adapterMode || "").toLowerCase();
  if (normalized === "legacy" || normalized === "legacy-primary") {
    return EXECUTION_MODE.LEGACY;
  }
  if (normalized === "canonical-primary") {
    return outputPreserved ? EXECUTION_MODE.SHADOW : EXECUTION_MODE.CANONICAL_PRIMARY;
  }
  if (normalized === "shadow" || normalized === "canonical-adapter") {
    return EXECUTION_MODE.SHADOW;
  }
  return EXECUTION_MODE.LEGACY;
}
