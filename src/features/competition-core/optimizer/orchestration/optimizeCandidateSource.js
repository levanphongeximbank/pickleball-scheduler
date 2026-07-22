/**
 * CORE-10 Phase 1I — Candidate Source Port wiring into existing orchestration.
 *
 * Thin synchronous wrapper: validate arguments, invoke Candidate Source Port
 * produce exactly once, then delegate the produced Candidate Batch to
 * optimizeSuppliedCandidates. CONTRACT_ONLY only.
 * No candidate generation, search, greedy, exhaustive solver, budget ownership,
 * or result remapping.
 */

import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { isCandidateSourcePort } from "../ports/candidateSourcePort.js";
import { optimizeSuppliedCandidates } from "./optimizeSuppliedCandidates.js";

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isThenable(value) {
  return (
    value != null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof /** @type {{ then?: unknown }} */ (value).then === "function"
  );
}

/**
 * @param {unknown} value
 * @param {string} label
 */
function rejectThenableOrPromise(value, label) {
  if (isThenable(value)) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      `${label} must not be a Promise/thenable`,
      {}
    );
  }
}

/**
 * Optimize via an approved Candidate Source Port, then delegate to the
 * existing supplied-candidate orchestration.
 * Synchronous only. Source executes exactly once per call.
 *
 * @param {unknown} optimizationRequest
 * @param {unknown} candidateSourcePort
 * @param {unknown} evaluationDependencies
 * @param {unknown} [sourceContext]
 * @returns {Readonly<object>}
 */
export function optimizeCandidateSource(
  optimizationRequest,
  candidateSourcePort,
  evaluationDependencies,
  sourceContext
) {
  rejectThenableOrPromise(optimizationRequest, "optimizationRequest");
  rejectThenableOrPromise(candidateSourcePort, "candidateSourcePort");
  rejectThenableOrPromise(evaluationDependencies, "evaluationDependencies");
  rejectThenableOrPromise(sourceContext, "sourceContext");

  if (!isCandidateSourcePort(candidateSourcePort)) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      "candidateSourcePort must be a valid Candidate Source Port",
      {}
    );
  }

  const producedCandidateBatch = candidateSourcePort.produce(
    optimizationRequest,
    sourceContext
  );

  return optimizeSuppliedCandidates(
    optimizationRequest,
    producedCandidateBatch,
    evaluationDependencies
  );
}
