/**
 * CORE-10 Phase 1C-B2-A — composeCandidateOptimizationScore.
 * Narrow wrapper over createOptimizationScore. Does not inject sentinel
 * objective values and does not use the Phase 1B CandidateSolution score builder.
 */

import { CANDIDATE_EVALUATION_FAILURE_CODE } from "../enums/candidateEvaluationFailureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { createOptimizationScore } from "../contracts/optimizationScore.js";
import { createObjectiveEvaluationRecord } from "../contracts/objectiveEvaluationRecord.js";
import { rejectUnknownFields, requireStableId } from "../contracts/shared.js";

const FAIL = CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED;

const ALLOWED = Object.freeze([
  "candidateId",
  "feasible",
  "hardViolationCount",
  "authorityValues",
  "objectiveEvaluations",
]);

/**
 * @param {object} obj
 * @param {string} key
 * @returns {unknown}
 */
function ownValue(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requireSafeInt(value, field) {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new OptimizerContractError(
      FAIL,
      `${field} must be a safe integer`,
      { field, value: value ?? null }
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

/**
 * @param {unknown} values
 * @param {string} field
 * @returns {number[]}
 */
function copyAuthorityValues(values, field) {
  if (!Array.isArray(values)) {
    throw new OptimizerContractError(
      FAIL,
      `${field} must be an array of safe integers`,
      { field }
    );
  }
  const source = values.slice();
  return source.map((v, i) => requireSafeInt(v, `${field}[${i}]`));
}

/**
 * Compose a rankable OptimizationScore for a feasible or infeasible candidate.
 * Calls createOptimizationScore only. Does not inject sentinel values.
 *
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function composeCandidateOptimizationScore(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "composeCandidateOptimizationScore input must be a plain object",
      {}
    );
  }

  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "composeCandidateOptimizationScore",
    FAIL
  );

  const candidateId = requireStableId(
    ownValue(partial, "candidateId"),
    "composeCandidateOptimizationScore.candidateId",
    FAIL
  );

  const feasible = ownValue(partial, "feasible");
  if (typeof feasible !== "boolean") {
    throw new OptimizerContractError(
      FAIL,
      "composeCandidateOptimizationScore.feasible must be a boolean",
      { feasible: feasible ?? null }
    );
  }

  const hardViolationCount = requireSafeInt(
    ownValue(partial, "hardViolationCount"),
    "composeCandidateOptimizationScore.hardViolationCount"
  );
  if (hardViolationCount < 0) {
    throw new OptimizerContractError(
      FAIL,
      "hardViolationCount must be a non-negative safe integer",
      { hardViolationCount }
    );
  }

  const authorityValues = copyAuthorityValues(
    ownValue(partial, "authorityValues"),
    "authorityValues"
  );

  const objectivesRaw = ownValue(partial, "objectiveEvaluations");
  if (!Array.isArray(objectivesRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "objectiveEvaluations must be an array",
      {}
    );
  }
  // Copy before iteration — never mutate caller array.
  const objectivesSource = objectivesRaw.slice();

  if (feasible) {
    if (hardViolationCount !== 0) {
      throw new OptimizerContractError(
        FAIL,
        "feasible score requires hardViolationCount === 0",
        { hardViolationCount }
      );
    }

    const objectiveValues = objectivesSource.map((item, i) => {
      let record;
      try {
        record = createObjectiveEvaluationRecord(
          item && typeof item === "object"
            ? { .../** @type {object} */ (item) }
            : {}
        );
      } catch (err) {
        if (err instanceof OptimizerContractError) {
          throw new OptimizerContractError(
            FAIL,
            `objectiveEvaluations[${i}] is not a valid ObjectiveEvaluationRecord`,
            { index: i, causeCode: err.code }
          );
        }
        throw err;
      }
      return requireSafeInt(
        record.orientedValue,
        `objectiveEvaluations[${i}].orientedValue`
      );
    });

    try {
      return createOptimizationScore({
        feasible: true,
        hardViolationCount: 0,
        authorityValues,
        objectiveValues,
        candidateId,
      });
    } catch (err) {
      if (err instanceof OptimizerContractError) {
        throw new OptimizerContractError(FAIL, err.message, {
          causeCode: err.code,
          ...(err.details || {}),
        });
      }
      throw err;
    }
  }

  if (hardViolationCount <= 0) {
    throw new OptimizerContractError(
      FAIL,
      "infeasible score requires hardViolationCount > 0",
      { hardViolationCount }
    );
  }
  if (objectivesSource.length !== 0) {
    throw new OptimizerContractError(
      FAIL,
      "infeasible score requires objectiveEvaluations to be an empty array",
      { length: objectivesSource.length }
    );
  }

  try {
    return createOptimizationScore({
      feasible: false,
      hardViolationCount,
      authorityValues,
      objectiveValues: [],
      candidateId,
    });
  } catch (err) {
    if (err instanceof OptimizerContractError) {
      throw new OptimizerContractError(FAIL, err.message, {
        causeCode: err.code,
        ...(err.details || {}),
      });
    }
    throw err;
  }
}
