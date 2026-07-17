import { OPTIMIZATION_STOP_REASON } from "../core/optimizationTypes.js";

/**
 * @returns {import('../core/optimizationTypes.js').OptimizationDiagnostics}
 */
export function createOptimizationDiagnostics(overrides = {}) {
  return {
    initialCandidateCount: 0,
    uniqueCandidateCount: 0,
    evaluatedCandidateCount: 0,
    acceptedMoveCount: 0,
    improvedMoveCount: 0,
    rejectedHardViolationCount: 0,
    durationMs: 0,
    stoppedBy: OPTIMIZATION_STOP_REASON.NO_FEASIBLE,
    ...overrides,
  };
}

export function finalizeDiagnostics(diagnostics, startedAt, stoppedBy) {
  return {
    ...diagnostics,
    durationMs: Math.max(0, Date.now() - startedAt),
    stoppedBy,
  };
}
