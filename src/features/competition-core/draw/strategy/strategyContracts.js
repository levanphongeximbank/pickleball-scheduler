import { DRAW_STRATEGY_ENGINE_VERSION } from "./strategyConstants.js";
import { createDrawExplanation, createDrawGroup } from "../drawContracts.js";
import { createDrawStrategyDefinition } from "./legacyStrategyMapping.js";

function clonePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value ?? null;
  }
  return { ...value };
}

function cloneArray(items, mapFn) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => (mapFn ? mapFn(item) : item));
}

export { createDrawStrategyDefinition } from "./legacyStrategyMapping.js";

/**
 * @param {Partial<import('./strategyTypes.js').DrawConfiguration>} [partial]
 * @returns {import('./strategyTypes.js').DrawConfiguration}
 */
export function createStrategyDrawConfiguration(partial = {}) {
  return {
    drawMode: partial.drawMode != null ? String(partial.drawMode) : null,
    groupCount: Number.isFinite(Number(partial.groupCount)) ? Number(partial.groupCount) : null,
    courtCount: Number.isFinite(Number(partial.courtCount)) ? Number(partial.courtCount) : null,
    randomSeed: partial.randomSeed ?? null,
    ruleSetVersion: partial.ruleSetVersion != null ? String(partial.ruleSetVersion) : null,
    options: clonePlainObject(partial.options) || undefined,
  };
}

/**
 * @param {Partial<import('./strategyTypes.js').StrategySelection>} [partial]
 * @returns {import('./strategyTypes.js').StrategySelection}
 */
export function createStrategySelection(partial = {}) {
  return {
    strategyId: String(partial.strategyId || "strategy_unknown"),
    distributionType: String(partial.distributionType || "unknown"),
    reason: partial.reason != null ? String(partial.reason) : null,
    strategy: partial.strategy ? createDrawStrategyDefinition(partial.strategy) : null,
  };
}

/**
 * @param {Partial<import('./strategyTypes.js').DistributionPolicy>} [partial]
 * @returns {import('./strategyTypes.js').DistributionPolicy}
 */
export function createDistributionPolicy(partial = {}) {
  return {
    type: String(partial.type || "unknown"),
    deterministic: partial.deterministic !== false,
    maxRetries: Number.isFinite(Number(partial.maxRetries)) ? Number(partial.maxRetries) : null,
    params: clonePlainObject(partial.params) || undefined,
  };
}

/**
 * @param {Partial<import('./strategyTypes.js').ConstraintPolicy>} [partial]
 * @returns {import('./strategyTypes.js').ConstraintPolicy}
 */
export function createConstraintPolicy(partial = {}) {
  return {
    enabled: partial.enabled !== false,
    categories: cloneArray(partial.categories, (item) => String(item)),
    repairAllowed: partial.repairAllowed === true,
    params: clonePlainObject(partial.params) || undefined,
  };
}

/**
 * @param {Partial<import('./strategyTypes.js').BalancePolicy>} [partial]
 * @returns {import('./strategyTypes.js').BalancePolicy}
 */
export function createBalancePolicy(partial = {}) {
  return {
    enabled: partial.enabled === true,
    metric: partial.metric != null ? String(partial.metric) : null,
    targetSpread: Number.isFinite(Number(partial.targetSpread))
      ? Number(partial.targetSpread)
      : null,
    params: clonePlainObject(partial.params) || undefined,
  };
}

/**
 * @param {Partial<import('./strategyTypes.js').SeedPolicy>} [partial]
 * @returns {import('./strategyTypes.js').SeedPolicy}
 */
export function createSeedPolicy(partial = {}) {
  return {
    required: partial.required === true,
    sourcePreference: partial.sourcePreference != null ? String(partial.sourcePreference) : null,
    allowManualOverride: partial.allowManualOverride !== false,
    params: clonePlainObject(partial.params) || undefined,
  };
}

/**
 * @param {Partial<import('./strategyTypes.js').DrawPlacement>} [partial]
 * @returns {import('./strategyTypes.js').DrawPlacement}
 */
export function createDrawPlacement(partial = {}) {
  return {
    entryId: partial.entryId != null ? String(partial.entryId) : null,
    teamId: partial.teamId != null ? String(partial.teamId) : null,
    groupId: partial.groupId != null ? String(partial.groupId) : null,
    groupIndex: Number.isFinite(Number(partial.groupIndex)) ? Number(partial.groupIndex) : null,
    seedNumber: Number.isFinite(Number(partial.seedNumber)) ? Number(partial.seedNumber) : null,
    slotIndex: Number.isFinite(Number(partial.slotIndex)) ? Number(partial.slotIndex) : null,
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * @param {Partial<import('./strategyTypes.js').DistributionStep>} [partial]
 * @returns {import('./strategyTypes.js').DistributionStep}
 */
export function createDistributionStep(partial = {}) {
  return {
    order: Number.isFinite(Number(partial.order)) ? Number(partial.order) : 0,
    action: String(partial.action || "place"),
    entryId: partial.entryId != null ? String(partial.entryId) : null,
    groupId: partial.groupId != null ? String(partial.groupId) : null,
    reason: partial.reason != null ? String(partial.reason) : null,
    details: clonePlainObject(partial.details) || undefined,
  };
}

/**
 * @param {Partial<import('./strategyTypes.js').StrategyDrawAudit>} [partial]
 * @returns {import('./strategyTypes.js').StrategyDrawAudit}
 */
export function createStrategyDrawAudit(partial = {}) {
  return {
    strategy: partial.strategy ? createDrawStrategyDefinition(partial.strategy) : null,
    distributionType: String(partial.distributionType || "unknown"),
    seedUsed: partial.seedUsed === true,
    constraintSummary: clonePlainObject(partial.constraintSummary) || {},
    balanceSummary: clonePlainObject(partial.balanceSummary) || {},
    randomSeed: partial.randomSeed ?? null,
    engineVersion: partial.engineVersion != null ? String(partial.engineVersion) : DRAW_STRATEGY_ENGINE_VERSION,
    recordedAt: partial.recordedAt != null ? String(partial.recordedAt) : null,
  };
}

/**
 * @param {Partial<import('./strategyTypes.js').StrategyDrawRequest>} [partial]
 * @returns {import('./strategyTypes.js').StrategyDrawRequest}
 */
export function createStrategyDrawRequest(partial = {}) {
  return {
    tournamentId: partial.tournamentId != null ? String(partial.tournamentId) : null,
    eventId: partial.eventId != null ? String(partial.eventId) : null,
    clubId: partial.clubId != null ? String(partial.clubId) : null,
    configuration: createStrategyDrawConfiguration(partial.configuration || {}),
    selection: partial.selection ? createStrategySelection(partial.selection) : undefined,
    distributionPolicy: partial.distributionPolicy
      ? createDistributionPolicy(partial.distributionPolicy)
      : undefined,
    constraintPolicy: partial.constraintPolicy
      ? createConstraintPolicy(partial.constraintPolicy)
      : undefined,
    balancePolicy: partial.balancePolicy ? createBalancePolicy(partial.balancePolicy) : undefined,
    seedPolicy: partial.seedPolicy ? createSeedPolicy(partial.seedPolicy) : undefined,
    entries: cloneArray(partial.entries, (item) => clonePlainObject(item) || {}),
    seeds: cloneArray(partial.seeds, (item) => clonePlainObject(item) || {}),
    options: clonePlainObject(partial.options) || undefined,
  };
}

/**
 * @param {Partial<import('./strategyTypes.js').StrategyDrawResult>} [partial]
 * @returns {import('./strategyTypes.js').StrategyDrawResult}
 */
export function createStrategyDrawResult(partial = {}) {
  return {
    ok: partial.ok !== false,
    groups: cloneArray(partial.groups, (group) => createDrawGroup(group)),
    placements: cloneArray(partial.placements, (item) => createDrawPlacement(item)),
    distributionSteps: cloneArray(partial.distributionSteps, (item) =>
      createDistributionStep(item)
    ),
    warnings: cloneArray(partial.warnings, (item) => String(item)),
    explanations: cloneArray(partial.explanations, (item) => createDrawExplanation(item)),
    audit: partial.audit ? createStrategyDrawAudit(partial.audit) : undefined,
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * Build explainability path for a strategy draw (foundation only).
 *
 * @param {import('./strategyTypes.js').DrawStrategyDefinition|null} strategy
 * @param {import('./strategyTypes.js').SeedPolicy} [seedPolicy]
 * @param {import('./strategyTypes.js').DistributionPolicy} [distributionPolicy]
 * @returns {import('../drawTypes.js').DrawExplanation}
 */
export function createStrategyDrawExplanation(strategy, seedPolicy, distributionPolicy) {
  const path = [
    "Strategy",
    strategy?.name || "Unknown",
    "Seed policy",
    seedPolicy?.required ? "Required" : "Optional",
    "Distribution",
    distributionPolicy?.type || strategy?.distributionType || "unknown",
    "Constraint resolution",
    strategy?.supportsConstraints ? "Supported" : "Not supported",
    "Final placement",
    "Foundation metadata only",
  ];

  return createDrawExplanation({
    code: "draw_strategy_explanation",
    title: "Draw strategy explainability",
    message: `Strategy ${strategy?.name || "Unknown"} selected for foundation draw planning.`,
    distributionPath: path,
    reasons: [
      `Distribution type: ${distributionPolicy?.type || strategy?.distributionType}`,
      strategy?.requiresSeed ? "Requires seed ordering" : "Seed optional",
    ],
  });
}

/**
 * @param {import('./strategyTypes.js').StrategyDrawRequest} request
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateStrategyDrawRequestShape(request) {
  const errors = [];
  if (!request || typeof request !== "object") {
    return { ok: false, errors: ["StrategyDrawRequest must be an object."] };
  }
  if (!request.configuration || typeof request.configuration !== "object") {
    errors.push("StrategyDrawRequest.configuration is required.");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @param {import('./strategyTypes.js').StrategyDrawResult} result
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateStrategyDrawResultShape(result) {
  const errors = [];
  if (!result || typeof result !== "object") {
    return { ok: false, errors: ["StrategyDrawResult must be an object."] };
  }
  if (!Array.isArray(result.groups)) {
    errors.push("StrategyDrawResult.groups must be an array.");
  }
  if (!Array.isArray(result.placements)) {
    errors.push("StrategyDrawResult.placements must be an array.");
  }
  if (!Array.isArray(result.distributionSteps)) {
    errors.push("StrategyDrawResult.distributionSteps must be an array.");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @param {import('./strategyTypes.js').StrategyDrawRequest} request
 * @returns {import('./strategyTypes.js').StrategyDrawRequest}
 */
export function cloneStrategyDrawRequest(request) {
  return createStrategyDrawRequest(request || {});
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function serializeStrategyDrawContract(value) {
  return JSON.parse(JSON.stringify(value));
}
