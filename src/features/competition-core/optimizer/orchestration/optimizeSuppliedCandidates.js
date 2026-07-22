/**
 * CORE-10 Phase 1F — supplied-candidate optimization orchestration.
 *
 * Supplied-input optimizer: evaluate a caller-supplied unevaluated candidate
 * batch, then rank and project OptimizationResult. CONTRACT_ONLY only.
 * No candidate generation, search, greedy, or exhaustive solver.
 */

import {
  CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_VERSION,
  CORE10_COMPARATOR_VERSION,
  CORE10_ENGINE_VERSION,
  CORE10_FINGERPRINT_VERSION,
  CORE10_HARD_VIOLATION_COMPOSITION_VERSION,
  CORE10_PRNG_VERSION,
  CORE10_SCHEMA_VERSION,
  CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION,
} from "../constants/versions.js";
import { CANDIDATE_EVALUATION_STATUS } from "../enums/candidateEvaluationStatus.js";
import { CANDIDATE_RANKING_FAILURE_CODE } from "../enums/candidateRankingFailureCodes.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OPTIMIZATION_OPERATION } from "../enums/optimizationOperation.js";
import { OPTIMIZATION_STATUS } from "../enums/optimizationStatus.js";
import { SOLVER_STRATEGY } from "../enums/solverStrategy.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { createCandidateEvaluationDependencies } from "../contracts/candidateEvaluationDependencies.js";
import { createCandidateEvaluationInput } from "../contracts/candidateEvaluationInput.js";
import { createOptimizationFailure } from "../contracts/optimizationFailure.js";
import { createOptimizationResult } from "../contracts/optimizationResult.js";
import { createReplayMetadata } from "../contracts/replayMetadata.js";
import { rejectUnknownFields, requireStableId } from "../contracts/shared.js";
import { compareStableString } from "../deterministic/compare.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { fingerprintValue } from "../deterministic/fingerprint.js";
import { validateOptimizationRequest } from "../constraints/structuralValidation.js";
import { createEmptySolverDiagnostics } from "../diagnostics/index.js";
import { evaluateCandidateSolution } from "../evaluation/evaluateCandidateSolution.js";
import { rankCandidateEvaluations } from "../ranking/rankCandidateEvaluations.js";

const ACCEPTED_OPERATION = OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING;
const ACCEPTED_STRATEGY = SOLVER_STRATEGY.CONTRACT_ONLY;

const RANKABLE_STATUSES = Object.freeze([
  CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE,
  CANDIDATE_EVALUATION_STATUS.VALID_INFEASIBLE,
]);

const BATCH_ALLOWED = Object.freeze([
  "candidates",
  "decisionVariables",
  "objectiveExecutionSpecs",
  "authorityValues",
  "context",
]);

const SUPPLIED_CANDIDATE_ALLOWED = Object.freeze([
  "candidateId",
  "assignments",
]);

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
 * @param {object} obj
 * @param {string} key
 * @returns {unknown}
 */
function ownValue(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

/**
 * Shallow own-property copy of frozen OptimizationContext for evaluation input.
 * Does not mutate the request-owned context.
 *
 * @param {Readonly<object>} context
 * @returns {object}
 */
function cloneContextForEvaluation(context) {
  return {
    tenantId: context.tenantId,
    competitionId: context.competitionId,
    snapshotRefs: context.snapshotRefs.map((ref) => ({
      snapshotId: ref.snapshotId,
      snapshotVersion: ref.snapshotVersion,
      fingerprint: ref.fingerprint,
      kind: ref.kind,
    })),
    metadata: { ...context.metadata },
  };
}

/**
 * @param {unknown} suppliedCandidateBatch
 * @param {Readonly<object>} request
 * @returns {{
 *   candidates: Array<{ candidateId: string, assignments: unknown }>,
 *   decisionVariables: unknown,
 *   objectiveExecutionSpecs: unknown,
 *   authorityValues: unknown,
 *   context: object,
 * }}
 */
function admitSuppliedCandidateBatch(suppliedCandidateBatch, request) {
  if (suppliedCandidateBatch === undefined || suppliedCandidateBatch === null) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      "suppliedCandidateBatch is required",
      { suppliedCandidateBatch: suppliedCandidateBatch ?? null }
    );
  }
  if (!isPlainObject(suppliedCandidateBatch)) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      "suppliedCandidateBatch must be a plain object",
      {}
    );
  }

  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (suppliedCandidateBatch),
    BATCH_ALLOWED,
    "suppliedCandidateBatch",
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );

  const candidatesRaw = ownValue(
    /** @type {object} */ (suppliedCandidateBatch),
    "candidates"
  );
  if (!Array.isArray(candidatesRaw)) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      "suppliedCandidateBatch.candidates must be an array",
      {}
    );
  }

  const decisionVariables = ownValue(
    /** @type {object} */ (suppliedCandidateBatch),
    "decisionVariables"
  );
  if (!Array.isArray(decisionVariables)) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      "suppliedCandidateBatch.decisionVariables must be an array",
      {}
    );
  }

  const objectiveExecutionSpecs = ownValue(
    /** @type {object} */ (suppliedCandidateBatch),
    "objectiveExecutionSpecs"
  );
  if (!Array.isArray(objectiveExecutionSpecs)) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      "suppliedCandidateBatch.objectiveExecutionSpecs must be an array",
      {}
    );
  }

  const authorityValues = ownValue(
    /** @type {object} */ (suppliedCandidateBatch),
    "authorityValues"
  );
  if (!Array.isArray(authorityValues)) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      "suppliedCandidateBatch.authorityValues must be an array of safe integers",
      {}
    );
  }

  let context;
  if (
    Object.prototype.hasOwnProperty.call(suppliedCandidateBatch, "context")
  ) {
    const contextRaw = ownValue(
      /** @type {object} */ (suppliedCandidateBatch),
      "context"
    );
    if (
      contextRaw === undefined ||
      contextRaw === null ||
      !isPlainObject(contextRaw)
    ) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
        "suppliedCandidateBatch.context must be a plain object when provided",
        {}
      );
    }
    context = {
      tenantId: /** @type {object} */ (contextRaw).tenantId,
      competitionId: /** @type {object} */ (contextRaw).competitionId,
      snapshotRefs: Array.isArray(
        /** @type {object} */ (contextRaw).snapshotRefs
      )
        ? /** @type {object} */ (contextRaw).snapshotRefs.map((ref) =>
            ref && typeof ref === "object" && !Array.isArray(ref)
              ? {
                  snapshotId: /** @type {object} */ (ref).snapshotId,
                  snapshotVersion: /** @type {object} */ (ref).snapshotVersion,
                  fingerprint: /** @type {object} */ (ref).fingerprint,
                  kind: /** @type {object} */ (ref).kind,
                }
              : ref
          )
        : /** @type {object} */ (contextRaw).snapshotRefs,
      metadata:
        /** @type {object} */ (contextRaw).metadata &&
        typeof /** @type {object} */ (contextRaw).metadata === "object" &&
        !Array.isArray(/** @type {object} */ (contextRaw).metadata)
          ? { .../** @type {object} */ (contextRaw).metadata }
          : /** @type {object} */ (contextRaw).metadata,
    };
  } else {
    context = cloneContextForEvaluation(request.context);
  }

  /** @type {Array<{ candidateId: string, assignments: unknown }>} */
  const candidates = [];
  const seenIds = new Set();
  for (let i = 0; i < candidatesRaw.length; i += 1) {
    const item = candidatesRaw[i];
    if (!isPlainObject(item)) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
        `suppliedCandidateBatch.candidates[${i}] must be a plain object`,
        { index: i }
      );
    }
    rejectUnknownFields(
      /** @type {Record<string, unknown>} */ (item),
      SUPPLIED_CANDIDATE_ALLOWED,
      `suppliedCandidateBatch.candidates[${i}]`,
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    );
    const candidateId = requireStableId(
      ownValue(/** @type {object} */ (item), "candidateId"),
      `suppliedCandidateBatch.candidates[${i}].candidateId`,
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    );
    if (seenIds.has(candidateId)) {
      throw new OptimizerContractError(
        CANDIDATE_RANKING_FAILURE_CODE.DUPLICATE_CANDIDATE_ID,
        `Duplicate candidateId in suppliedCandidateBatch: ${candidateId}`,
        { candidateId, index: i }
      );
    }
    seenIds.add(candidateId);
    const assignments = ownValue(
      /** @type {object} */ (item),
      "assignments"
    );
    if (!Array.isArray(assignments)) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
        `suppliedCandidateBatch.candidates[${i}].assignments must be an array`,
        { index: i, candidateId }
      );
    }
    candidates.push({
      candidateId,
      assignments: assignments.map((assignment) =>
        assignment && typeof assignment === "object" && !Array.isArray(assignment)
          ? {
              variableId: /** @type {object} */ (assignment).variableId,
              valueId: /** @type {object} */ (assignment).valueId,
            }
          : assignment
      ),
    });
  }

  return {
    candidates,
    decisionVariables: decisionVariables.map((dv) =>
      dv && typeof dv === "object" && !Array.isArray(dv)
        ? {
            variableId: /** @type {object} */ (dv).variableId,
            domain: Array.isArray(/** @type {object} */ (dv).domain)
              ? [.../** @type {object} */ (dv).domain]
              : /** @type {object} */ (dv).domain,
            required: /** @type {object} */ (dv).required,
          }
        : dv
    ),
    objectiveExecutionSpecs: objectiveExecutionSpecs.map((spec) =>
      spec && typeof spec === "object" && !Array.isArray(spec)
        ? { .../** @type {object} */ (spec) }
        : spec
    ),
    authorityValues: [...authorityValues],
    context,
  };
}

/**
 * Deterministic canonical evaluation order by candidateId (UTF-16 code units).
 * Does not mutate the admitted candidates array in place of the caller batch.
 *
 * @param {ReadonlyArray<{ candidateId: string, assignments: unknown }>} candidates
 * @returns {Array<{ candidateId: string, assignments: unknown }>}
 */
function canonicalizeCandidateOrder(candidates) {
  const ordered = candidates.slice();
  ordered.sort((a, b) => compareStableString(a.candidateId, b.candidateId));
  return ordered;
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
 * @param {number} candidateCount
 * @param {number} evaluationCount
 * @param {string | null} failureCode
 * @returns {string}
 */
function buildResultFingerprint(
  request,
  ranking,
  status,
  candidateCount,
  evaluationCount,
  failureCode
) {
  return fingerprintValue({
    optimizationVersion: CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION,
    rankingVersion: ranking.rankingVersion,
    schemaVersion: request.schemaVersion,
    requestId: request.requestId,
    status,
    failureCode,
    selectedCandidateId: ranking.selectedCandidateId,
    rankedCandidateIds: [...ranking.rankedCandidateIds],
    candidateCount,
    feasibleCount: ranking.feasibleCount,
    infeasibleCount: ranking.infeasibleCount,
    evaluationCount,
  });
}

/**
 * Evaluate a supplied unevaluated candidate batch and project OptimizationResult.
 * Synchronous only. CONTRACT_ONLY / GENERIC_CANDIDATE_RANKING.
 *
 * @param {unknown} optimizationRequest
 * @param {unknown} suppliedCandidateBatch
 * @param {unknown} evaluationDependencies
 * @returns {Readonly<object>}
 */
export function optimizeSuppliedCandidates(
  optimizationRequest,
  suppliedCandidateBatch,
  evaluationDependencies
) {
  rejectThenableOrPromise(optimizationRequest, "optimizationRequest");
  rejectThenableOrPromise(suppliedCandidateBatch, "suppliedCandidateBatch");
  rejectThenableOrPromise(evaluationDependencies, "evaluationDependencies");

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
      `Phase 1F supplied-candidate optimization requires operation ${ACCEPTED_OPERATION}; received ${request.operation.operationId}`,
      {
        operationId: request.operation.operationId,
        expected: ACCEPTED_OPERATION,
      }
    );
  }

  if (request.strategy !== ACCEPTED_STRATEGY) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.UNSUPPORTED_STRATEGY,
      `Phase 1F supplied-candidate optimization requires strategy ${ACCEPTED_STRATEGY}; received ${request.strategy}`,
      {
        strategy: request.strategy,
        expected: ACCEPTED_STRATEGY,
      }
    );
  }

  const batch = admitSuppliedCandidateBatch(suppliedCandidateBatch, request);
  const orderedCandidates = canonicalizeCandidateOrder(batch.candidates);
  const candidateCount = orderedCandidates.length;

  // Fail closed on malformed dependencies before any evaluation.
  const dependencies = createCandidateEvaluationDependencies(
    evaluationDependencies &&
      typeof evaluationDependencies === "object" &&
      !Array.isArray(evaluationDependencies)
      ? {
          .../** @type {object} */ (evaluationDependencies),
        }
      : /** @type {object} */ (evaluationDependencies)
  );

  /** @type {object[]} */
  const evaluatedFrontier = [];
  let evaluationCount = 0;

  for (const supplied of orderedCandidates) {
    const evaluationInput = createCandidateEvaluationInput({
      schemaVersion: CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_VERSION,
      evaluationVersion: CORE10_HARD_VIOLATION_COMPOSITION_VERSION,
      request,
      context: batch.context,
      candidate: {
        candidateId: supplied.candidateId,
        operation: request.operation.operationId,
        assignments: supplied.assignments,
      },
      decisionVariables: batch.decisionVariables,
      objectiveExecutionSpecs: batch.objectiveExecutionSpecs,
      authorityValues: batch.authorityValues,
    });

    const evaluationResult = evaluateCandidateSolution(
      evaluationInput,
      dependencies
    );
    evaluationCount += 1;

    if (!RANKABLE_STATUSES.includes(evaluationResult.status)) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
        `Supplied candidate evaluation status ${evaluationResult.status} is not rankable; only VALID_FEASIBLE and VALID_INFEASIBLE are accepted into the frontier`,
        {
          candidateId: evaluationResult.candidateId,
          status: evaluationResult.status,
          failure: evaluationResult.failure ?? null,
        }
      );
    }

    evaluatedFrontier.push(evaluationResult);
  }

  const ranking = rankCandidateEvaluations(evaluatedFrontier);

  const status =
    ranking.selectedCandidateId != null
      ? OPTIMIZATION_STATUS.SUCCESS
      : OPTIMIZATION_STATUS.INFEASIBLE;

  const rankedCandidateIds = [...ranking.rankedCandidateIds];

  const diagnostics = createEmptySolverDiagnostics({
    candidateCount,
    feasibleCount: ranking.feasibleCount,
    infeasibleCount: ranking.infeasibleCount,
    prunedCount: 0,
    budgetUsage: {
      nodes: 0,
      candidates: candidateCount,
      evaluations: evaluationCount,
    },
    budgetExhausted: false,
    watchdogTimeout: false,
  });

  /** @type {object | null} */
  let failure = null;
  if (status === OPTIMIZATION_STATUS.INFEASIBLE) {
    failure = createOptimizationFailure({
      code: OPTIMIZATION_FAILURE_CODE.INFEASIBLE,
      message:
        candidateCount === 0
          ? "Empty supplied candidate batch; no candidate available"
          : "No feasible candidate in supplied candidate batch",
      details: {
        candidateCount,
        feasibleCount: ranking.feasibleCount,
        infeasibleCount: ranking.infeasibleCount,
        evaluationCount,
        optimizationVersion: CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION,
        rankingVersion: ranking.rankingVersion,
      },
    });
  }

  const failureCode = failure ? failure.code : null;
  const resultFingerprint = buildResultFingerprint(
    request,
    ranking,
    status,
    candidateCount,
    evaluationCount,
    failureCode
  );

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
    selectedCandidateId: ranking.selectedCandidateId,
    rankedCandidateIds,
    failure,
    diagnostics,
    replayMetadata,
    resultFingerprint,
  });
}
