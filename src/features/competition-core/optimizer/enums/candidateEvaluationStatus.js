/**
 * CORE-10 Phase 1C-B1 — per-candidate evaluation status.
 * Distinct from run-level OPTIMIZATION_STATUS.
 * Phase 1C-B1 does not yet produce VALID_FEASIBLE / VALID_INFEASIBLE outcomes.
 */

export const CANDIDATE_EVALUATION_STATUS = Object.freeze({
  VALID_FEASIBLE: "VALID_FEASIBLE",
  VALID_INFEASIBLE: "VALID_INFEASIBLE",
  INVALID_CANDIDATE: "INVALID_CANDIDATE",
  EVALUATION_FAILED: "EVALUATION_FAILED",
});
