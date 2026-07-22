/**
 * CORE-10 — CandidateSolution contract.
 */

import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { createConstraintEvaluation, createObjectiveEvaluation } from "./evaluations.js";
import { createOptimizationScore } from "./optimizationScore.js";
import {
  domainValueKey,
  rejectUnknownFields,
  requireBoolean,
  requireNonNegativeInt,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "candidateId",
  "assignments",
  "feasible",
  "hardViolationCount",
  "constraintEvaluations",
  "objectiveEvaluations",
  "score",
]);

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createCandidateSolution(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "CandidateSolution",
    OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
  );

  if (!isPlainObject(partial.assignments)) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
      "CandidateSolution.assignments must be a plain object",
      {}
    );
  }

  /** @type {Record<string, string|number|boolean|null>} */
  const assignments = {};
  for (const key of Object.keys(partial.assignments)) {
    const variableId = requireStableId(
      key,
      "CandidateSolution.assignments key",
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
    );
    const value = partial.assignments[key];
    domainValueKey(value);
    assignments[variableId] = /** @type {string|number|boolean|null} */ (value);
  }

  const feasible = requireBoolean(
    partial.feasible,
    "CandidateSolution.feasible",
    OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
  );
  const hardViolationCount = requireNonNegativeInt(
    partial.hardViolationCount,
    "CandidateSolution.hardViolationCount",
    OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
  );

  if (feasible && hardViolationCount !== 0) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
      "feasible candidate cannot have hardViolationCount > 0",
      { hardViolationCount }
    );
  }
  if (!feasible && hardViolationCount === 0) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
      "infeasible candidate must have hardViolationCount > 0",
      {}
    );
  }

  const constraintEvaluations = Array.isArray(partial.constraintEvaluations)
    ? partial.constraintEvaluations.map((c) => createConstraintEvaluation(c))
    : [];
  const objectiveEvaluations = Array.isArray(partial.objectiveEvaluations)
    ? partial.objectiveEvaluations.map((o) => createObjectiveEvaluation(o))
    : [];

  const candidateId = requireStableId(
    partial.candidateId,
    "CandidateSolution.candidateId",
    OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
  );

  let score = null;
  if (partial.score != null) {
    score = createOptimizationScore({
      ...partial.score,
      candidateId: partial.score.candidateId ?? candidateId,
      feasible: partial.score.feasible ?? feasible,
      hardViolationCount:
        partial.score.hardViolationCount ?? hardViolationCount,
    });
  }

  return Object.freeze({
    candidateId,
    assignments: Object.freeze({ ...assignments }),
    feasible,
    hardViolationCount,
    constraintEvaluations: Object.freeze(constraintEvaluations),
    objectiveEvaluations: Object.freeze(objectiveEvaluations),
    score,
  });
}
