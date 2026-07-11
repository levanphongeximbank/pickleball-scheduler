import { COMPETITION_CORE_VERSION } from "../constants/index.js";
import { COMPETITION_ENGINE_TYPE } from "../constants/engineType.js";
import { isRatingV2Enabled } from "../config/featureFlags.js";
import { ENGINE_RUN_STATUS } from "../constants/engineRunStatus.js";
import { getCompetitionCoreFeatureFlags } from "../config/featureFlags.js";
import {
  createCompetitionEngineResult,
  createEngineRunMetadata,
  createEngineValidationResult,
} from "../contracts/engineContracts.js";
import { cloneCompetitionEngineInput } from "../utils/inputClone.js";

/**
 * @typedef {import('../types/index.js').CompetitionEngineInput} CompetitionEngineInput
 * @typedef {import('../types/index.js').CompetitionEngineResult} CompetitionEngineResult
 */

/** @type {Record<string, string>} */
export const LEGACY_ENGINE_IDS = Object.freeze({
  [COMPETITION_ENGINE_TYPE.DRAW]: "legacy:drawEngine|seededGroupEngine|openConditionalRandomEngine",
  [COMPETITION_ENGINE_TYPE.TEAM_FORMATION]: "legacy:teamPairingEngine|tournament.seeding.logic",
  [COMPETITION_ENGINE_TYPE.MATCHMAKING]: "legacy:ai/engine.runAI",
  [COMPETITION_ENGINE_TYPE.SCHEDULING]: "legacy:scheduleEngine|tournament.fixtures.logic",
  [COMPETITION_ENGINE_TYPE.STANDINGS]: "legacy:rankingEngine|teamStandingsEngine",
  [COMPETITION_ENGINE_TYPE.RATING]: "legacy:eloEngine|eloService|clubEloService",
});

/**
 * CC-02B: Rating V2 available when rating flag enabled.
 * @param {import('../types/engineType.js').CompetitionEngineTypeValue} engineType
 * @param {Record<string, unknown>|undefined|null} [envSource]
 * @returns {boolean}
 */
export function isEngineV2Available(engineType, envSource) {
  if (engineType === COMPETITION_ENGINE_TYPE.RATING) {
    return isRatingV2Enabled(envSource);
  }
  void envSource;
  return false;
}

/**
 * @param {import('../types/engineType.js').CompetitionEngineTypeValue} engineType
 * @param {import('../config/featureFlags.js').CompetitionCoreFeatureFlags} flags
 * @returns {boolean}
 */
export function isEngineV2FlagEnabled(engineType, flags) {
  switch (engineType) {
    case COMPETITION_ENGINE_TYPE.DRAW:
      return flags.drawV2Enabled;
    case COMPETITION_ENGINE_TYPE.MATCHMAKING:
      return flags.matchmakingV2Enabled;
    case COMPETITION_ENGINE_TYPE.STANDINGS:
      return flags.standingsV2Enabled;
    case COMPETITION_ENGINE_TYPE.RATING:
      return flags.ratingV2Enabled;
    case COMPETITION_ENGINE_TYPE.TEAM_FORMATION:
    case COMPETITION_ENGINE_TYPE.SCHEDULING:
      return flags.coreEnabled;
    default:
      return false;
  }
}

/**
 * @typedef {Object} EngineExecutionPlan
 * @property {'legacy'|'v2'} executionPath
 * @property {CompetitionEngineInput} input
 * @property {string} legacyEngineId
 * @property {boolean} v2FlagEnabled
 * @property {boolean} v2Available
 */

/**
 * @param {CompetitionEngineInput} input
 * @param {Record<string, unknown>|undefined|null} [envSource]
 * @returns {EngineExecutionPlan}
 */
export function resolveEngineExecutionPlan(input, envSource) {
  const flags = getCompetitionCoreFeatureFlags(envSource);
  const normalizedInput = cloneCompetitionEngineInput(input);
  const v2FlagEnabled = flags.coreEnabled && isEngineV2FlagEnabled(input.engineType, flags);
  const v2Available = isEngineV2Available(input.engineType, envSource);
  const executionPath = v2FlagEnabled && v2Available ? "v2" : "legacy";

  return {
    executionPath,
    input: normalizedInput,
    legacyEngineId: LEGACY_ENGINE_IDS[input.engineType] || "legacy:unknown",
    v2FlagEnabled,
    v2Available,
  };
}

/**
 * Wrap a legacy engine result without altering business payload.
 *
 * @param {Object} options
 * @param {import('../types/engineType.js').CompetitionEngineTypeValue} options.engineType
 * @param {string} options.legacyEngine
 * @param {unknown} options.legacyResult
 * @param {'legacy'|'v2'} [options.executionPath]
 * @param {string[]} [options.warnings]
 * @returns {CompetitionEngineResult}
 */
export function wrapLegacyEngineResult({
  engineType,
  legacyEngine,
  legacyResult,
  executionPath = "legacy",
  warnings = [],
}) {
  const legacyOk =
    legacyResult &&
    typeof legacyResult === "object" &&
    "ok" in /** @type {object} */ (legacyResult)
      ? /** @type {{ ok?: boolean }} */ (legacyResult).ok !== false
      : legacyResult != null;

  const legacyErrors =
    legacyResult &&
    typeof legacyResult === "object" &&
    Array.isArray(/** @type {{ errors?: string[] }} */ (legacyResult).errors)
      ? /** @type {{ errors: string[] }} */ (legacyResult).errors
      : [];

  return createCompetitionEngineResult({
    success: legacyOk,
    engineType,
    engineVersion: COMPETITION_CORE_VERSION,
    result: legacyResult,
    validation: createEngineValidationResult({
      ok: legacyOk,
      errors: legacyErrors,
      warnings,
    }),
    warnings,
    metadata: createEngineRunMetadata({
      legacyEngine,
      status: legacyOk ? ENGINE_RUN_STATUS.COMPLETED : ENGINE_RUN_STATUS.FAILED,
      featureFlag: executionPath === "v2" ? "v2" : "legacy",
    }),
    error: legacyOk ? null : legacyErrors[0] || "Legacy engine failed",
    executionPath,
  });
}

/**
 * Execute via injected legacy executor — CC-01 does not import legacy engines directly.
 *
 * @param {CompetitionEngineInput} input
 * @param {Object} [options]
 * @param {(normalizedInput: CompetitionEngineInput) => unknown|Promise<unknown>} [options.legacyExecutor]
 * @param {Record<string, unknown>|undefined|null} [options.envSource]
 * @returns {Promise<CompetitionEngineResult>}
 */
export async function executeCompetitionEngine(input, options = {}) {
  const plan = resolveEngineExecutionPlan(input, options.envSource);

  if (plan.executionPath === "v2") {
    return createCompetitionEngineResult({
      success: false,
      engineType: input.engineType,
      error: "Competition Core V2 engine not available in CC-01",
      executionPath: "v2",
      metadata: createEngineRunMetadata({
        legacyEngine: plan.legacyEngineId,
        status: ENGINE_RUN_STATUS.FAILED,
        featureFlag: "v2-unavailable",
      }),
    });
  }

  const legacyExecutor = options.legacyExecutor;
  if (typeof legacyExecutor !== "function") {
    return createCompetitionEngineResult({
      success: false,
      engineType: input.engineType,
      error: "Legacy executor not configured",
      executionPath: "legacy",
      warnings: ["CC-01 adapter shell — inject legacyExecutor to delegate"],
      metadata: createEngineRunMetadata({
        legacyEngine: plan.legacyEngineId,
        status: ENGINE_RUN_STATUS.PENDING,
        featureFlag: "legacy-shell",
      }),
    });
  }

  const legacyResult = await legacyExecutor(plan.input);
  return wrapLegacyEngineResult({
    engineType: input.engineType,
    legacyEngine: plan.legacyEngineId,
    legacyResult,
    executionPath: "legacy",
    warnings: plan.v2FlagEnabled
      ? ["V2 flag enabled but CC-01 falls back to legacy path"]
      : [],
  });
}
