/**
 * CORE-10 Phase 1E — project OptimizationResult from a supplied evaluated frontier.
 *
 * Uses Phase 1D rankCandidateEvaluations only. No search / solvers / generation.
 */

import {
  CORE10_COMPARATOR_VERSION,
  CORE10_ENGINE_VERSION,
  CORE10_FINGERPRINT_VERSION,
  CORE10_PRNG_VERSION,
  CORE10_SCHEMA_VERSION,
  CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_VERSION,
} from "../constants/versions.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OPTIMIZATION_OPERATION } from "../enums/optimizationOperation.js";
import { OPTIMIZATION_STATUS } from "../enums/optimizationStatus.js";
import { SOLVER_STRATEGY } from "../enums/solverStrategy.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { createOptimizationFailure } from "../contracts/optimizationFailure.js";
import { createOptimizationResult } from "../contracts/optimizationResult.js";
import { createReplayMetadata } from "../contracts/replayMetadata.js";
import { fingerprintValue } from "../deterministic/fingerprint.js";
import { validateOptimizationRequest } from "../constraints/structuralValidation.js";
import { createEmptySolverDiagnostics } from "../diagnostics/index.js";
import { rankCandidateEvaluations } from "../ranking/rankCandidateEvaluations.js";

const ACCEPTED_OPERATION = OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING;
const ACCEPTED_STRATEGY = SOLVER_STRATEGY.CONTRACT_ONLY;

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
 * @param {Readonly<object>} request
 * @param {Readonly<{
 *   rankedCandidateIds: ReadonlyArray<string>,
 *   selectedCandidateId: string | null,
 *   feasibleCount: number,
 *   infeasibleCount: number,
 *   rankingVersion: string,
 * }>} ranking
 * @param {string} status
 * @returns {string}
 */
function buildResultFingerprint(request, ranking, status) {
  return fingerprintValue({
    projectionVersion: CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_VERSION,
    rankingVersion: ranking.rankingVersion,
    schemaVersion: request.schemaVersion,
    requestId: request.requestId,
    status,
    selectedCandidateId: ranking.selectedCandidateId,
    rankedCandidateIds: [...ranking.rankedCandidateIds],
    feasibleCount: ranking.feasibleCount,
    infeasibleCount: ranking.infeasibleCount,
  });
}

/**
 * Project an OptimizationResult from an OptimizationRequest and a supplied
 * frontier of already evaluated candidates. Synchronous only.
 *
 * @param {unknown} optimizationRequest
 * @param {unknown} evaluatedFrontier
 * @returns {Readonly<object>}
 */
export function projectOptimizationResultFromEvaluatedFrontier(
  optimizationRequest,
  evaluatedFrontier
) {
  rejectThenableOrPromise(optimizationRequest, "optimizationRequest");
  rejectThenableOrPromise(evaluatedFrontier, "evaluatedFrontier");

  if (optimizationRequest === undefined || optimizationRequest === null) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      "optimizationRequest is required",
      { optimizationRequest: optimizationRequest ?? null }
    );
  }

  const validated = validateOptimizationRequest(optimizationRequest);
  if (!validated.ok) {
    const issue = validated.issues[0] || {
      code: OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      message: "Invalid OptimizationRequest",
      details: {},
    };
    throw new OptimizerContractError(
      issue.code,
      issue.message,
      issue.details || {}
    );
  }
  const request = validated.request;

  if (request.operation.operationId !== ACCEPTED_OPERATION) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_OPERATION,
      `Phase 1E supplied-frontier projection requires operation ${ACCEPTED_OPERATION}; received ${request.operation.operationId}`,
      {
        operationId: request.operation.operationId,
        expected: ACCEPTED_OPERATION,
      }
    );
  }

  if (request.strategy !== ACCEPTED_STRATEGY) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.UNSUPPORTED_STRATEGY,
      `Phase 1E supplied-frontier projection requires strategy ${ACCEPTED_STRATEGY}; received ${request.strategy}`,
      {
        strategy: request.strategy,
        expected: ACCEPTED_STRATEGY,
      }
    );
  }

  // Frontier admission / ranking — Phase 1D owns validation + comparator.
  const ranking = rankCandidateEvaluations(evaluatedFrontier);

  const status =
    ranking.selectedCandidateId != null
      ? OPTIMIZATION_STATUS.SUCCESS
      : OPTIMIZATION_STATUS.INFEASIBLE;

  const rankedCandidateIds = [...ranking.rankedCandidateIds];
  const candidateCount = rankedCandidateIds.length;

  // Frontier/result counts are observational only. Phase 1E does not search,
  // evaluate, or consume deterministic budget — budgetUsage stays zero.
  const diagnostics = createEmptySolverDiagnostics({
    candidateCount,
    feasibleCount: ranking.feasibleCount,
    infeasibleCount: ranking.infeasibleCount,
    prunedCount: 0,
    budgetUsage: {
      nodes: 0,
      candidates: 0,
      evaluations: 0,
    },
    budgetExhausted: false,
    watchdogTimeout: false,
  });

  const resultFingerprint = buildResultFingerprint(request, ranking, status);

  const inputSnapshotFingerprints = request.context.snapshotRefs.map(
    (ref) => ref.fingerprint
  );

  const replayMetadata = createReplayMetadata({
    engineVersion: CORE10_ENGINE_VERSION,
    contractSchemaVersion: CORE10_SCHEMA_VERSION,
    policyId: request.policy.policyId,
    policyVersion: request.policy.policyVersion,
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    fingerprintAlgorithmVersion: CORE10_FINGERPRINT_VERSION,
    inputSnapshotFingerprints,
    seed: request.seed,
    prngVersion: request.seed ? CORE10_PRNG_VERSION : null,
    operationId: request.operation.operationId,
    deterministicBudget: {
      maxNodes: request.deterministicBudget.maxNodes,
      maxCandidates: request.deterministicBudget.maxCandidates,
      maxEvaluations: request.deterministicBudget.maxEvaluations,
    },
    resultFingerprint,
  });

  /** @type {object | null} */
  let failure = null;
  if (status === OPTIMIZATION_STATUS.INFEASIBLE) {
    failure = createOptimizationFailure({
      code: OPTIMIZATION_FAILURE_CODE.INFEASIBLE,
      message:
        candidateCount === 0
          ? "Empty evaluated frontier; no candidate available"
          : "No feasible candidate in evaluated frontier",
      details: {
        candidateCount,
        feasibleCount: ranking.feasibleCount,
        infeasibleCount: ranking.infeasibleCount,
        projectionVersion: CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_VERSION,
        rankingVersion: ranking.rankingVersion,
      },
    });
  }

  return createOptimizationResult({
    status,
    requestId: request.requestId,
    selectedCandidateId: ranking.selectedCandidateId,
    rankedCandidateIds,
    failure,
    diagnostics,
    replayMetadata,
    resultFingerprint,
  });
}
