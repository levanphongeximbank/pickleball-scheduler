/**
 * CORE-10 Phase 1D — deterministic ranking / feasible-winner selection
 * across a supplied frontier of already evaluated candidates.
 *
 * Reuses CORE10_COMPARATOR_V1 via sortScoresDeterministic.
 * Does not generate candidates, search, or project OptimizationResult.
 */

import { CORE10_CANDIDATE_RANKING_VERSION } from "../constants/versions.js";
import { CANDIDATE_EVALUATION_STATUS } from "../enums/candidateEvaluationStatus.js";
import { CANDIDATE_RANKING_FAILURE_CODE } from "../enums/candidateRankingFailureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { createCandidateEvaluationResult } from "../contracts/candidateEvaluationResult.js";
import { createOptimizationScore } from "../contracts/optimizationScore.js";
import { sortScoresDeterministic } from "../scoring/compareScores.js";

const FAIL = CANDIDATE_RANKING_FAILURE_CODE.INVALID_CANDIDATE_RANKING_INPUT;
const DUP = CANDIDATE_RANKING_FAILURE_CODE.DUPLICATE_CANDIDATE_ID;

const RANKABLE_STATUSES = Object.freeze([
  CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE,
  CANDIDATE_EVALUATION_STATUS.VALID_INFEASIBLE,
]);

/** Own-property keys cloned for revalidation (matches result ALLOWED). */
const RESULT_FIELDS = Object.freeze([
  "candidateId",
  "operation",
  "status",
  "feasible",
  "structuralViolations",
  "businessViolations",
  "allHardViolations",
  "objectiveEvaluations",
  "optimizationScore",
  "failure",
  "portDescriptor",
  "inputFingerprint",
  "evaluationVersion",
  "schemaVersion",
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
 * @param {object} obj
 * @param {string} key
 * @returns {unknown}
 */
function ownValue(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

/**
 * Shallow own-property clone for revalidation. Does not mutate or freeze caller.
 *
 * @param {object} result
 * @returns {object}
 */
function buildOwnedRevalidationInput(result) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of RESULT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      out[key] = ownValue(result, key);
    }
  }
  return out;
}

/**
 * @param {Readonly<object>} score
 * @returns {Readonly<object>}
 */
function ownOptimizationScore(score) {
  return createOptimizationScore({
    feasible: score.feasible,
    hardViolationCount: score.hardViolationCount,
    authorityValues: [...score.authorityValues],
    objectiveValues: [...score.objectiveValues],
    displayTotal: score.displayTotal,
    comparatorVersion: score.comparatorVersion,
    candidateId: score.candidateId,
  });
}

/**
 * Rank a frontier of CandidateEvaluationResult values and select the
 * best feasible winner. Synchronous only.
 *
 * @param {unknown} frontier
 * @returns {Readonly<{
 *   rankedCandidateIds: ReadonlyArray<string>,
 *   selectedCandidateId: string | null,
 *   rankedScores: ReadonlyArray<object>,
 *   feasibleCount: number,
 *   infeasibleCount: number,
 *   rankingVersion: string,
 * }>}
 */
export function rankCandidateEvaluations(frontier) {
  if (frontier === undefined || frontier === null) {
    throw new OptimizerContractError(
      FAIL,
      "rankCandidateEvaluations frontier must be an array",
      { frontier: frontier ?? null }
    );
  }
  if (isThenable(frontier)) {
    throw new OptimizerContractError(
      FAIL,
      "rankCandidateEvaluations does not accept Promise/thenable frontiers",
      {}
    );
  }
  if (!Array.isArray(frontier)) {
    throw new OptimizerContractError(
      FAIL,
      "rankCandidateEvaluations frontier must be an array",
      { type: typeof frontier }
    );
  }

  // Copy immediately — never mutate caller array.
  const source = frontier.slice();

  if (source.length === 0) {
    return Object.freeze({
      rankedCandidateIds: Object.freeze([]),
      selectedCandidateId: null,
      rankedScores: Object.freeze([]),
      feasibleCount: 0,
      infeasibleCount: 0,
      rankingVersion: CORE10_CANDIDATE_RANKING_VERSION,
    });
  }

  /** @type {object[]} */
  const ownedScores = [];
  /** @type {Set<string>} */
  const seenIds = new Set();

  for (let i = 0; i < source.length; i += 1) {
    const item = source[i];
    if (isThenable(item)) {
      throw new OptimizerContractError(
        FAIL,
        `frontier[${i}] must not be a Promise/thenable`,
        { index: i }
      );
    }
    if (!isPlainObject(item)) {
      throw new OptimizerContractError(
        FAIL,
        `frontier[${i}] must be a plain CandidateEvaluationResult object`,
        { index: i }
      );
    }

    const validated = createCandidateEvaluationResult(
      buildOwnedRevalidationInput(item)
    );

    if (!RANKABLE_STATUSES.includes(validated.status)) {
      throw new OptimizerContractError(
        FAIL,
        `frontier[${i}] status ${validated.status} is not rankable; only VALID_FEASIBLE and VALID_INFEASIBLE are accepted`,
        { index: i, status: validated.status }
      );
    }

    if (validated.optimizationScore == null) {
      throw new OptimizerContractError(
        FAIL,
        `frontier[${i}] requires a non-null optimizationScore`,
        { index: i, candidateId: validated.candidateId ?? null }
      );
    }

    if (validated.optimizationScore.candidateId !== validated.candidateId) {
      throw new OptimizerContractError(
        FAIL,
        `frontier[${i}] optimizationScore.candidateId must equal result.candidateId`,
        {
          index: i,
          candidateId: validated.candidateId,
          scoreCandidateId: validated.optimizationScore.candidateId,
        }
      );
    }

    const candidateId = validated.candidateId;
    if (seenIds.has(candidateId)) {
      throw new OptimizerContractError(
        DUP,
        `Duplicate candidateId in ranking frontier: ${candidateId}`,
        { candidateId, index: i }
      );
    }
    seenIds.add(candidateId);

    ownedScores.push(ownOptimizationScore(validated.optimizationScore));
  }

  const rankedScores = Object.freeze(sortScoresDeterministic(ownedScores));
  const rankedCandidateIds = Object.freeze(
    rankedScores.map((score) => score.candidateId)
  );

  let selectedCandidateId = null;
  let feasibleCount = 0;
  let infeasibleCount = 0;
  for (const score of rankedScores) {
    if (score.feasible) {
      feasibleCount += 1;
      if (selectedCandidateId == null) {
        selectedCandidateId = score.candidateId;
      }
    } else {
      infeasibleCount += 1;
    }
  }

  return Object.freeze({
    rankedCandidateIds,
    selectedCandidateId,
    rankedScores,
    feasibleCount,
    infeasibleCount,
    rankingVersion: CORE10_CANDIDATE_RANKING_VERSION,
  });
}
