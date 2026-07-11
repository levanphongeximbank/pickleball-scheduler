/**
 * Competition Core Draw Engine foundation — CC-04A.
 * Importing this module MUST NOT execute draw algorithms or mutate tournament state.
 */

export {
  DRAW_ENGINE_VERSION,
  DEFAULT_DRAW_RULE_SET_VERSION,
  CANONICAL_DRAW_MODE,
  CANONICAL_DRAW_MODE_VALUES,
  isCanonicalDrawMode,
  DRAW_SEED_SOURCE,
  DRAW_SEED_SOURCE_VALUES,
  isDrawSeedSource,
  DRAW_STRATEGY_KIND,
  DRAW_STRATEGY_KIND_VALUES,
  isDrawStrategyKind,
  DRAW_CONSTRAINT_CATEGORY,
  DRAW_CONSTRAINT_CATEGORY_VALUES,
  isDrawConstraintCategory,
  DRAW_RANDOM_GENERATOR,
  DRAW_RANDOM_GENERATOR_VALUES,
  isDrawRandomGenerator,
} from "./drawConstants.js";

export {
  CC01_DRAW_MODE_TO_CANONICAL,
  LEGACY_DRAW_MODE_MAPPINGS,
  mapLegacyDrawModeToCanonical,
  mapCc01DrawModeToCanonical,
} from "./legacyDrawMapping.js";

export {
  createDrawSeed,
  createDrawGroup,
  createDrawCandidate,
  createDrawConstraint,
  createDrawExplanation,
  createDrawConflict,
  createDrawScoreBreakdown,
  createDrawRandomMetadata,
  createDrawStrategy,
  createDrawMetadata,
  createDrawAudit,
  createDrawRequest,
  createDrawResult,
  createDrawEngineResult,
  validateDrawRequestShape,
  validateDrawResultShape,
  cloneDrawRequest,
  serializeDrawContract,
} from "./drawContracts.js";

export {
  createSeedStrategy,
  createDistributionStrategy,
  createConstraintStrategy,
  createBalancingStrategy,
  createRandomStrategy,
  createAuditStrategy,
  createExplainStrategy,
  createDefaultDrawStrategyBundle,
} from "./drawStrategies.js";

export {
  createManualDrawSeed,
  createAverageLevelDrawSeed,
  createCompetitionEloDrawSeed,
  createWinRateDrawSeed,
  createPerformanceDrawSeed,
  createProvisionalDrawSeed,
  createNewPlayerDrawSeed,
  createManualAdjustmentDrawSeed,
  normalizeDrawSeeds,
} from "./seedModel.js";
