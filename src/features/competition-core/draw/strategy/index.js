/**
 * Competition Core Canonical Draw Strategy foundation — CC-04C.
 * Importing this module MUST NOT execute draw algorithms or mutate tournament state.
 */

export {
  DRAW_STRATEGY_ENGINE_VERSION,
  DISTRIBUTION_TYPE,
  DISTRIBUTION_TYPE_VALUES,
  isDistributionType,
  CANONICAL_DRAW_STRATEGY_ID,
  CANONICAL_DRAW_STRATEGY_ID_VALUES,
  isCanonicalDrawStrategyId,
  DEFAULT_STRATEGY_CAPABILITIES,
} from "./strategyConstants.js";

export {
  CANONICAL_DRAW_STRATEGY_CATALOG,
  LEGACY_DRAW_STRATEGY_INVENTORY,
  mapLegacyStrategyKeyToCatalogId,
  getDrawStrategyFromCatalog,
  createDrawStrategyDefinition,
} from "./legacyStrategyMapping.js";

export {
  createStrategyDrawConfiguration,
  createStrategySelection,
  createDistributionPolicy,
  createConstraintPolicy,
  createBalancePolicy,
  createSeedPolicy,
  createDrawPlacement,
  createDistributionStep,
  createStrategyDrawAudit,
  createStrategyDrawRequest,
  createStrategyDrawResult,
  createStrategyDrawExplanation,
  validateStrategyDrawRequestShape,
  validateStrategyDrawResultShape,
  cloneStrategyDrawRequest,
  serializeStrategyDrawContract,
} from "./strategyContracts.js";

export {
  selectDrawStrategy,
  deriveDefaultPoliciesFromStrategy,
  buildFoundationStrategyDrawResult,
} from "./strategySelection.js";
