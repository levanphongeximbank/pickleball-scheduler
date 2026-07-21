/**
 * CORE-10 — diagnostics helpers (contracts only; no persistence).
 */

import { createSolverDiagnostics } from "../contracts/solverDiagnostics.js";
import {
  CORE10_COMPARATOR_VERSION,
  CORE10_FINGERPRINT_VERSION,
} from "../constants/versions.js";

/**
 * @param {object} [partial]
 * @returns {ReturnType<typeof createSolverDiagnostics>}
 */
export function createEmptySolverDiagnostics(partial = {}) {
  return createSolverDiagnostics({
    validationFailures: [],
    candidateCount: 0,
    feasibleCount: 0,
    infeasibleCount: 0,
    prunedCount: 0,
    budgetUsage: { nodes: 0, candidates: 0, evaluations: 0 },
    budgetExhausted: false,
    watchdogTimeout: false,
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    fingerprintAlgorithmVersion: CORE10_FINGERPRINT_VERSION,
    nonReplay: {},
    ...partial,
  });
}

export { createSolverDiagnostics };
