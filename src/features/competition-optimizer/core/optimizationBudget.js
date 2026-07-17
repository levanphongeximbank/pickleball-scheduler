import { OPTIMIZATION_OPERATION } from "./optimizationTypes.js";

/** Default budget for MLP 4 with ~8 teams (spec §XI). */
export const DEFAULT_MLP4_BUDGET = Object.freeze({
  maxInitialCandidates: 250,
  maxEvaluations: 10000,
  maxIterations: 2000,
  maxDurationMs: 3000,
  stagnationLimit: 300,
});

export const DEFAULT_PARTNER_PAIRING_BUDGET = Object.freeze({
  maxInitialCandidates: 128,
  maxEvaluations: 4000,
  maxIterations: 800,
  maxDurationMs: 2000,
  stagnationLimit: 200,
});

export const DEFAULT_GROUP_DRAW_BUDGET = Object.freeze({
  maxInitialCandidates: 96,
  maxEvaluations: 4000,
  maxIterations: 800,
  maxDurationMs: 2000,
  stagnationLimit: 200,
});

/**
 * @param {string} operation
 * @param {Partial<import('./optimizationTypes.js').OptimizationBudget>} [overrides]
 */
export function resolveOptimizationBudget(operation, overrides = {}) {
  let base = DEFAULT_MLP4_BUDGET;
  if (operation === OPTIMIZATION_OPERATION.PARTNER_PAIRING) {
    base = DEFAULT_PARTNER_PAIRING_BUDGET;
  } else if (operation === OPTIMIZATION_OPERATION.GROUP_DRAW) {
    base = DEFAULT_GROUP_DRAW_BUDGET;
  }

  return {
    maxInitialCandidates: Math.max(
      0,
      Number(overrides.maxInitialCandidates ?? base.maxInitialCandidates) || 0
    ),
    maxEvaluations: Math.max(
      0,
      Number(overrides.maxEvaluations ?? base.maxEvaluations) || 0
    ),
    maxIterations: Math.max(
      0,
      Number(overrides.maxIterations ?? base.maxIterations) || 0
    ),
    maxDurationMs: Math.max(
      0,
      Number(overrides.maxDurationMs ?? base.maxDurationMs) || 0
    ),
    stagnationLimit: Math.max(
      0,
      Number(overrides.stagnationLimit ?? base.stagnationLimit) || 0
    ),
  };
}
