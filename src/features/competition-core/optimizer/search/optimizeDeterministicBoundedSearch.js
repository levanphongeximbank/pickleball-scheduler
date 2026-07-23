/**
 * CORE-10 Phase 1L — certified deterministic bounded-search optimization entry.
 *
 * Flow: admit request/spec → assert envelope → search → apply envelope →
 * optimizeSuppliedCandidates → merge search diagnostics / status.
 * Does not duplicate evaluation or ranking logic.
 */

import {
  CORE10_COMPARATOR_VERSION,
  CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1,
  CORE10_ENGINE_VERSION,
  CORE10_FINGERPRINT_VERSION,
  CORE10_PRNG_VERSION,
  CORE10_SCHEMA_VERSION,
  CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2,
} from "../constants/versions.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OPTIMIZATION_STATUS } from "../enums/optimizationStatus.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { createOptimizationFailure } from "../contracts/optimizationFailure.js";
import { createOptimizationResult } from "../contracts/optimizationResult.js";
import { createReplayMetadata } from "../contracts/replayMetadata.js";
import { fingerprintValue } from "../deterministic/fingerprint.js";
import { createEmptySolverDiagnostics } from "../diagnostics/index.js";
import { optimizeSuppliedCandidates } from "../orchestration/optimizeSuppliedCandidates.js";
import {
  applyCandidateEvaluationEnvelope,
  assertCandidateEvaluationEnvelopeCompatible,
} from "../enrichment/candidateEvaluationEnvelope.js";
import { createDeterministicBoundedSearchSpec } from "./deterministicBoundedSearchSpec.js";
import { searchDeterministicCandidates } from "./searchDeterministicCandidates.js";

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
 * @param {Readonly<object>} searchSpec
 * @param {Readonly<object>} searchResult
 * @param {Readonly<object>} suppliedResult
 * @param {string} status
 * @param {string | null} failureCode
 * @returns {string}
 */
function buildBoundedSearchResultFingerprint(
  request,
  searchSpec,
  searchResult,
  suppliedResult,
  status,
  failureCode
) {
  return fingerprintValue({
    optimizationVersion: CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1,
    suppliedOptimizationVersion: CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2,
    searchVersion: searchResult.searchVersion,
    strategy: searchResult.strategy,
    maxNodes: request.deterministicBudget.maxNodes,
    nodesVisited: searchResult.nodesVisited,
    searchComplete: searchResult.searchComplete,
    nodeBudgetExhausted: searchResult.nodeBudgetExhausted,
    maxEmittedCandidates: searchSpec.maxEmittedCandidates,
    emittedCount: searchResult.emittedCount,
    emittedCandidateBudgetExhausted:
      searchResult.emittedCandidateBudgetExhausted,
    schemaVersion: request.schemaVersion,
    requestId: request.requestId,
    status,
    failureCode,
    selectedCandidateId: suppliedResult.selectedCandidateId,
    rankedCandidateIds: [...suppliedResult.rankedCandidateIds],
    candidateCount: suppliedResult.diagnostics.candidateCount,
    feasibleCandidateCount: suppliedResult.diagnostics.feasibleCount,
    infeasibleCandidateCount: suppliedResult.diagnostics.infeasibleCount,
    evaluationCount: suppliedResult.diagnostics.budgetUsage.evaluations,
    suppliedBudgetExhausted: suppliedResult.diagnostics.budgetExhausted,
    suppliedResultFingerprint: suppliedResult.resultFingerprint,
  });
}

/**
 * Certified bounded-search optimization entry.
 *
 * @param {unknown} optimizationRequest
 * @param {unknown} searchSpec
 * @param {unknown} evaluationEnvelope
 * @param {unknown} dependencies
 * @returns {Readonly<object>}
 */
export function optimizeDeterministicBoundedSearch(
  optimizationRequest,
  searchSpec,
  evaluationEnvelope,
  dependencies
) {
  rejectThenableOrPromise(optimizationRequest, "optimizationRequest");
  rejectThenableOrPromise(searchSpec, "searchSpec");
  rejectThenableOrPromise(evaluationEnvelope, "evaluationEnvelope");
  rejectThenableOrPromise(dependencies, "dependencies");

  const compatibility = assertCandidateEvaluationEnvelopeCompatible(
    optimizationRequest,
    evaluationEnvelope
  );
  const request = compatibility.request;
  const envelope = compatibility.evaluationEnvelope;
  const admittedSpec = createDeterministicBoundedSearchSpec(
    /** @type {object} */ (searchSpec)
  );

  const searchResult = searchDeterministicCandidates(request, admittedSpec);
  const evaluationReadyBatch = applyCandidateEvaluationEnvelope(
    searchResult.candidateBatch,
    envelope
  );

  const suppliedResult = optimizeSuppliedCandidates(
    request,
    evaluationReadyBatch,
    dependencies
  );

  const searchBudgetExhausted =
    searchResult.nodeBudgetExhausted ||
    searchResult.emittedCandidateBudgetExhausted;

  /** @type {string} */
  let status = suppliedResult.status;
  /** @type {object | null} */
  let failure = suppliedResult.failure
    ? {
        code: suppliedResult.failure.code,
        message: suppliedResult.failure.message,
        details: { ...suppliedResult.failure.details },
      }
    : null;

  if (searchBudgetExhausted) {
    status = OPTIMIZATION_STATUS.BUDGET_EXHAUSTED;
    failure = createOptimizationFailure({
      code: OPTIMIZATION_FAILURE_CODE.BUDGET_EXHAUSTED,
      message: searchResult.nodeBudgetExhausted
        ? "Deterministic bounded search stopped because maxNodes was exhausted"
        : "Deterministic bounded search stopped because maxEmittedCandidates was reached",
      details: {
        searchVersion: searchResult.searchVersion,
        strategy: searchResult.strategy,
        maxNodes: request.deterministicBudget.maxNodes,
        nodesVisited: searchResult.nodesVisited,
        searchComplete: searchResult.searchComplete,
        nodeBudgetExhausted: searchResult.nodeBudgetExhausted,
        maxEmittedCandidates: admittedSpec.maxEmittedCandidates,
        emittedCount: searchResult.emittedCount,
        emittedCandidateBudgetExhausted:
          searchResult.emittedCandidateBudgetExhausted,
        suppliedStatus: suppliedResult.status,
        suppliedFailureCode: suppliedResult.failure
          ? suppliedResult.failure.code
          : null,
        selectedCandidateId: suppliedResult.selectedCandidateId,
        rankedCandidateIds: [...suppliedResult.rankedCandidateIds],
        candidateCount: suppliedResult.diagnostics.candidateCount,
        feasibleCount: suppliedResult.diagnostics.feasibleCount,
        infeasibleCount: suppliedResult.diagnostics.infeasibleCount,
        evaluationCount: suppliedResult.diagnostics.budgetUsage.evaluations,
        optimizationVersion: CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1,
        suppliedOptimizationVersion: CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2,
      },
    });
  } else if (failure) {
    failure = createOptimizationFailure({
      code: failure.code,
      message: failure.message,
      details: {
        ...failure.details,
        searchVersion: searchResult.searchVersion,
        strategy: searchResult.strategy,
        maxNodes: request.deterministicBudget.maxNodes,
        nodesVisited: searchResult.nodesVisited,
        searchComplete: searchResult.searchComplete,
        nodeBudgetExhausted: searchResult.nodeBudgetExhausted,
        maxEmittedCandidates: admittedSpec.maxEmittedCandidates,
        emittedCount: searchResult.emittedCount,
        emittedCandidateBudgetExhausted:
          searchResult.emittedCandidateBudgetExhausted,
        optimizationVersion: CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1,
      },
    });
  }

  const failureCode = failure ? failure.code : null;
  const resultFingerprint = buildBoundedSearchResultFingerprint(
    request,
    admittedSpec,
    searchResult,
    suppliedResult,
    status,
    failureCode
  );

  const diagnostics = createEmptySolverDiagnostics({
    validationFailures: [...suppliedResult.diagnostics.validationFailures],
    candidateCount: suppliedResult.diagnostics.candidateCount,
    feasibleCount: suppliedResult.diagnostics.feasibleCount,
    infeasibleCount: suppliedResult.diagnostics.infeasibleCount,
    prunedCount: suppliedResult.diagnostics.prunedCount,
    budgetUsage: {
      nodes: searchResult.nodesVisited,
      candidates: Math.max(
        suppliedResult.diagnostics.budgetUsage.candidates,
        searchResult.emittedCount
      ),
      evaluations: suppliedResult.diagnostics.budgetUsage.evaluations,
    },
    budgetExhausted:
      searchBudgetExhausted || suppliedResult.diagnostics.budgetExhausted,
    watchdogTimeout: false,
  });

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

  return createOptimizationResult({
    status,
    requestId: request.requestId,
    selectedCandidateId: suppliedResult.selectedCandidateId,
    rankedCandidateIds: [...suppliedResult.rankedCandidateIds],
    failure,
    diagnostics,
    replayMetadata,
    resultFingerprint,
  });
}
