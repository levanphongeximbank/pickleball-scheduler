/**
 * Competition Core public API — CC-01 foundation layer.
 * Importing this module MUST NOT trigger database writes or legacy engine execution.
 */

export {
  COMPETITION_CORE_VERSION,
  DRAW_MODE,
  DRAW_MODE_VALUES,
  isDrawMode,
  COMPETITION_RATING_STATUS,
  COMPETITION_RATING_STATUS_VALUES,
  isCompetitionRatingStatus,
  RATING_SOURCE,
  RATING_SOURCE_VALUES,
  isRatingSource,
  CONSTRAINT_SEVERITY,
  CONSTRAINT_SEVERITY_VALUES,
  isConstraintSeverity,
  COMPETITION_CONSTRAINT_TYPE,
  COMPETITION_CONSTRAINT_TYPE_VALUES,
  isCompetitionConstraintType,
  COMPETITION_ENGINE_TYPE,
  COMPETITION_ENGINE_TYPE_VALUES,
  isCompetitionEngineType,
  ENGINE_RUN_STATUS,
  ENGINE_RUN_STATUS_VALUES,
  isEngineRunStatus,
  RATING_ELIGIBILITY_STATUS,
  RATING_ELIGIBILITY_STATUS_VALUES,
  isRatingEligibilityStatus,
} from "./constants/index.js";

export {
  COMPETITION_CORE_FLAG_KEYS,
  getCompetitionCoreFeatureFlags,
  isCompetitionCoreEnabled,
  isRatingV2Enabled,
  isDrawV2Enabled,
  isMatchmakingV2Enabled,
  isStandingsV2Enabled,
} from "./config/featureFlags.js";

export { parseEnvBoolean, readEnvBoolean, readEnvString } from "./config/envReader.js";

export {
  createEngineValidationResult,
  createEngineScoreBreakdown,
  createEngineExplanation,
  createEngineRunMetadata,
  createCompetitionEngineInput,
  createCompetitionEngineResult,
  createRatingSnapshot,
  createDrawConfiguration,
  createConstraintDefinition,
  createConstraintConflict,
} from "./contracts/engineContracts.js";

export {
  LEGACY_ENGINE_IDS,
  isEngineV2Available,
  isEngineV2FlagEnabled,
  resolveEngineExecutionPlan,
  wrapLegacyEngineResult,
  executeCompetitionEngine,
} from "./adapters/legacyAdapter.js";

export {
  LEGACY_OPEN_TERMINOLOGY,
  findLegacyTerminologyEntry,
  previewCanonicalDrawModeFromLegacy,
} from "./utils/legacyTerminology.js";

export {
  cloneCompetitionEngineInput,
  isBusinessPayloadPreserved,
} from "./utils/inputClone.js";

export {
  mapCompetitionEloToSkill,
  mapSkillToCompetitionElo,
  mapLegacySkillToInitialElo,
  isMatchRatingEligible,
  resolveKFactor,
  getPlayerCompetitionElo,
  buildRatingSnapshotFromPlayer,
  backfillPlayerRatingV2Fields,
  applyCompetitionEloFromMatchRecord,
  backfillClubPlayerRatingsV2,
  assessMonthlyPublicLevelV2,
} from "./rating/index.js";
