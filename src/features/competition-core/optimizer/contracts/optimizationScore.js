/**
 * CORE-10 — OptimizationScore contract (rankable representation).
 */

import { CORE10_COMPARATOR_VERSION } from "../constants/versions.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import {
  rejectUnknownFields,
  requireBoolean,
  requireNonNegativeInt,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "feasible",
  "hardViolationCount",
  "authorityValues",
  "objectiveValues",
  "displayTotal",
  "comparatorVersion",
  "candidateId",
]);

/**
 * @param {unknown} values
 * @param {string} field
 * @returns {number[]}
 */
function requireIntArray(values, field) {
  if (!Array.isArray(values)) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
      `${field} must be an array of integers`,
      { field }
    );
  }
  return values.map((v, i) => {
    if (typeof v !== "number" || !Number.isInteger(v) || !Number.isFinite(v)) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
        `${field}[${i}] must be a finite integer`,
        { field, index: i, value: v ?? null }
      );
    }
    return v;
  });
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createOptimizationScore(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "OptimizationScore",
    OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
  );

  const comparatorVersion = requireStableId(
    partial.comparatorVersion ?? CORE10_COMPARATOR_VERSION,
    "OptimizationScore.comparatorVersion",
    OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
  );
  if (comparatorVersion !== CORE10_COMPARATOR_VERSION) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
      `Unsupported comparatorVersion: ${comparatorVersion}`,
      { comparatorVersion }
    );
  }

  let displayTotal = null;
  if (partial.displayTotal != null) {
    if (
      typeof partial.displayTotal !== "number" ||
      !Number.isInteger(partial.displayTotal) ||
      !Number.isFinite(partial.displayTotal)
    ) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
        "displayTotal must be a finite integer when present",
        { displayTotal: partial.displayTotal }
      );
    }
    displayTotal = partial.displayTotal;
  }

  const feasible = requireBoolean(
    partial.feasible,
    "OptimizationScore.feasible",
    OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
  );
  const hardViolationCount = requireNonNegativeInt(
    partial.hardViolationCount,
    "OptimizationScore.hardViolationCount",
    OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
  );

  if (feasible && hardViolationCount !== 0) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
      "feasible score cannot have hardViolationCount > 0",
      { hardViolationCount }
    );
  }
  if (!feasible && hardViolationCount === 0) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
      "infeasible score must have hardViolationCount > 0",
      {}
    );
  }

  return Object.freeze({
    feasible,
    hardViolationCount,
    authorityValues: Object.freeze(
      requireIntArray(partial.authorityValues ?? [], "authorityValues")
    ),
    objectiveValues: Object.freeze(
      requireIntArray(partial.objectiveValues ?? [], "objectiveValues")
    ),
    displayTotal,
    comparatorVersion,
    candidateId: requireStableId(
      partial.candidateId,
      "OptimizationScore.candidateId",
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
    ),
  });
}
