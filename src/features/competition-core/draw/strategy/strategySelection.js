import {
  CANONICAL_DRAW_STRATEGY_ID,
  DISTRIBUTION_TYPE,
} from "./strategyConstants.js";
import {
  CANONICAL_DRAW_STRATEGY_CATALOG,
  getDrawStrategyFromCatalog,
  mapLegacyStrategyKeyToCatalogId,
} from "./legacyStrategyMapping.js";
import {
  createBalancePolicy,
  createConstraintPolicy,
  createDistributionPolicy,
  createSeedPolicy,
  createStrategyDrawAudit,
  createStrategyDrawExplanation,
  createStrategyDrawResult,
  createStrategySelection,
} from "./strategyContracts.js";

/**
 * Select canonical draw strategy from request hints — foundation only.
 *
 * @param {import('./strategyTypes.js').StrategyDrawRequest} request
 * @returns {import('./strategyTypes.js').StrategySelection}
 */
export function selectDrawStrategy(request = {}) {
  const legacyKey =
    request.options?.legacyStrategyKey ||
    request.options?.strategyKey ||
    request.configuration?.drawMode ||
    "unknown";

  const strategyId = mapLegacyStrategyKeyToCatalogId(legacyKey, request.options?.contextHint);
  const strategy = getDrawStrategyFromCatalog(strategyId);

  return createStrategySelection({
    strategyId,
    distributionType: strategy?.distributionType || DISTRIBUTION_TYPE.UNKNOWN,
    reason: `Mapped legacy key "${String(legacyKey)}" to catalog strategy.`,
    strategy,
  });
}

/**
 * Derive default policies from selected strategy — no runtime execution.
 *
 * @param {import('./strategyTypes.js').DrawStrategyDefinition|null} strategy
 * @param {import('./strategyTypes.js').StrategyDrawRequest} request
 */
export function deriveDefaultPoliciesFromStrategy(strategy, request = {}) {
  const distributionPolicy = createDistributionPolicy({
    type: strategy?.distributionType || DISTRIBUTION_TYPE.UNKNOWN,
    deterministic: strategy?.distributionType === DISTRIBUTION_TYPE.SNAKE,
    maxRetries: strategy?.distributionType === DISTRIBUTION_TYPE.HYBRID ? 48 : null,
    params: request.distributionPolicy?.params,
  });

  const constraintPolicy = createConstraintPolicy({
    enabled: strategy?.supportsConstraints === true,
    categories: request.constraintPolicy?.categories || [],
    repairAllowed: strategy?.supportsConstraints === true,
    params: request.constraintPolicy?.params,
  });

  const balancePolicy = createBalancePolicy({
    enabled: strategy?.supportsBalance === true,
    metric: strategy?.supportsBalance ? "average_level" : null,
    targetSpread: request.balancePolicy?.targetSpread ?? null,
    params: request.balancePolicy?.params,
  });

  const seedPolicy = createSeedPolicy({
    required: strategy?.requiresSeed === true,
    sourcePreference: request.seedPolicy?.sourcePreference || null,
    allowManualOverride: request.seedPolicy?.allowManualOverride !== false,
    params: request.seedPolicy?.params,
  });

  return { distributionPolicy, constraintPolicy, balancePolicy, seedPolicy };
}

/**
 * Build foundation strategy draw result envelope with audit + explainability.
 * Does NOT perform group assignment or call legacy draw engines.
 *
 * @param {import('./strategyTypes.js').StrategyDrawRequest} request
 * @returns {import('./strategyTypes.js').StrategyDrawResult}
 */
export function buildFoundationStrategyDrawResult(request = {}) {
  const selection = request.selection || selectDrawStrategy(request);
  const strategy = selection.strategy || getDrawStrategyFromCatalog(selection.strategyId);
  const policies = deriveDefaultPoliciesFromStrategy(strategy, request);

  const explanation = createStrategyDrawExplanation(
    strategy,
    policies.seedPolicy,
    policies.distributionPolicy
  );

  const audit = createStrategyDrawAudit({
    strategy,
    distributionType: selection.distributionType,
    seedUsed: policies.seedPolicy.required || (request.seeds || []).length > 0,
    constraintSummary: {
      enabled: policies.constraintPolicy.enabled,
      categories: policies.constraintPolicy.categories,
      repairAllowed: policies.constraintPolicy.repairAllowed,
    },
    balanceSummary: {
      enabled: policies.balancePolicy.enabled,
      metric: policies.balancePolicy.metric,
      targetSpread: policies.balancePolicy.targetSpread,
    },
    randomSeed: request.configuration?.randomSeed ?? null,
  });

  const warnings = [];
  if (selection.strategyId === CANONICAL_DRAW_STRATEGY_ID.UNKNOWN) {
    warnings.push("Unknown draw strategy — foundation metadata only.");
  }
  if (strategy?.distributionType === DISTRIBUTION_TYPE.SWISS_READY) {
    warnings.push("Swiss distribution is contract-ready but not implemented in runtime.");
  }

  return createStrategyDrawResult({
    ok: selection.strategyId !== CANONICAL_DRAW_STRATEGY_ID.UNKNOWN,
    groups: [],
    placements: [],
    distributionSteps: [],
    warnings,
    explanations: [explanation],
    audit,
    metadata: {
      engineVersion: audit.engineVersion,
      catalogSize: CANONICAL_DRAW_STRATEGY_CATALOG.length,
      foundationOnly: true,
    },
  });
}
