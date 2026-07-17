/**
 * Shared contracts for V5 Global Competition Optimizer.
 * Pure types / constants — no search logic.
 */

export const OPTIMIZATION_OPERATION = Object.freeze({
  TEAM_FORMATION: "TEAM_FORMATION",
  PARTNER_PAIRING: "PARTNER_PAIRING",
  GROUP_DRAW: "GROUP_DRAW",
});

export const OPTIMIZATION_STOP_REASON = Object.freeze({
  TARGET_REACHED: "TARGET_REACHED",
  MAX_EVALUATIONS: "MAX_EVALUATIONS",
  MAX_ITERATIONS: "MAX_ITERATIONS",
  MAX_DURATION: "MAX_DURATION",
  STAGNATION: "STAGNATION",
  NO_FEASIBLE: "NO_FEASIBLE",
  BUDGET_ZERO: "BUDGET_ZERO",
});

export const MLP4_GLOBAL_ALGORITHM_VERSION = "mlp4-global-optimizer-v1";
export const PARTNER_PAIRING_GLOBAL_ALGORITHM_VERSION =
  "partner-pairing-global-optimizer-v1";
export const GROUP_DRAW_GLOBAL_ALGORITHM_VERSION =
  "group-draw-global-optimizer-v1";

/**
 * @typedef {Object} OptimizationBudget
 * @property {number} maxInitialCandidates
 * @property {number} maxEvaluations
 * @property {number} maxIterations
 * @property {number} maxDurationMs
 * @property {number} stagnationLimit
 */

/**
 * @typedef {Object} OptimizationCandidateScore
 * @property {boolean} feasible
 * @property {number} hardViolationCount
 * @property {number} superAdminPenalty
 * @property {number} tournamentPenalty
 * @property {number} clubPenalty
 * @property {number} sessionPenalty
 * @property {number} defaultPenalty
 * @property {number} totalPenalty
 * @property {Record<string, unknown>} [diagnostics]
 */

/**
 * @typedef {Object} OptimizationDiagnostics
 * @property {number} initialCandidateCount
 * @property {number} uniqueCandidateCount
 * @property {number} evaluatedCandidateCount
 * @property {number} acceptedMoveCount
 * @property {number} improvedMoveCount
 * @property {number} rejectedHardViolationCount
 * @property {number} durationMs
 * @property {string} stoppedBy
 */

/**
 * Empty score shell.
 * @param {Partial<OptimizationCandidateScore>} [overrides]
 * @returns {OptimizationCandidateScore}
 */
export function createEmptyCandidateScore(overrides = {}) {
  return {
    feasible: false,
    hardViolationCount: 0,
    superAdminPenalty: 0,
    tournamentPenalty: 0,
    clubPenalty: 0,
    sessionPenalty: 0,
    defaultPenalty: 0,
    totalPenalty: 0,
    diagnostics: {},
    ...overrides,
  };
}
