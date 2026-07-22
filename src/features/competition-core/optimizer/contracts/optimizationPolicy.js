/**
 * CORE-10 — OptimizationPolicy contract.
 */

import { CORE10_COMPARATOR_VERSION } from "../constants/versions.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import {
  rejectUnknownFields,
  requirePositiveInt,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "policyId",
  "policyVersion",
  "objectiveKeys",
  "authorityKeys",
  "comparatorVersion",
  "quantizeScale",
]);

/** Forbidden objective keys per Owner decision. */
export const FORBIDDEN_OBJECTIVE_KEYS = Object.freeze([
  "OBJ_HARD_FEASIBILITY",
  "OBJ_MATCHPLAN_INTEGRITY",
  "OBJ_SEARCH_STABILITY",
]);

/**
 * @param {unknown} keys
 * @param {string} field
 * @returns {string[]}
 */
function normalizeKeyList(keys, field) {
  if (keys == null) return [];
  if (!Array.isArray(keys)) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_POLICY,
      `${field} must be an array of strings`,
      { field }
    );
  }
  const out = [];
  const seen = new Set();
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (typeof key !== "string" || key.trim() === "") {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_POLICY,
        `${field}[${i}] must be a non-empty string`,
        { field, index: i }
      );
    }
    const trimmed = key.trim();
    if (FORBIDDEN_OBJECTIVE_KEYS.includes(trimmed)) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_POLICY,
        `${trimmed} is not an objective; use feasibility gate / structural validation / candidateId tie-break`,
        { field, key: trimmed }
      );
    }
    if (seen.has(trimmed)) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_POLICY,
        `Duplicate key in ${field}: ${trimmed}`,
        { field, key: trimmed }
      );
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * @param {object} partial
 * @returns {Readonly<{
 *   policyId: string,
 *   policyVersion: string,
 *   objectiveKeys: ReadonlyArray<string>,
 *   authorityKeys: ReadonlyArray<string>,
 *   comparatorVersion: string,
 *   quantizeScale: number,
 * }>}
 */
export function createOptimizationPolicy(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "OptimizationPolicy",
    OPTIMIZATION_FAILURE_CODE.INVALID_POLICY
  );

  const comparatorVersion = requireStableId(
    partial.comparatorVersion ?? CORE10_COMPARATOR_VERSION,
    "OptimizationPolicy.comparatorVersion",
    OPTIMIZATION_FAILURE_CODE.INVALID_POLICY
  );
  if (comparatorVersion !== CORE10_COMPARATOR_VERSION) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_POLICY,
      `Unsupported comparatorVersion: ${comparatorVersion}`,
      { comparatorVersion, expected: CORE10_COMPARATOR_VERSION }
    );
  }

  const objectiveKeys = normalizeKeyList(
    partial.objectiveKeys,
    "OptimizationPolicy.objectiveKeys"
  );
  if (objectiveKeys.length === 0) {
    // Empty objective list is allowed for feasibility-only ranking (hard gate + candidateId).
  }

  return Object.freeze({
    policyId: requireStableId(
      partial.policyId,
      "OptimizationPolicy.policyId",
      OPTIMIZATION_FAILURE_CODE.INVALID_POLICY
    ),
    policyVersion: requireStableId(
      partial.policyVersion,
      "OptimizationPolicy.policyVersion",
      OPTIMIZATION_FAILURE_CODE.INVALID_POLICY
    ),
    objectiveKeys: Object.freeze(objectiveKeys),
    authorityKeys: Object.freeze(
      normalizeKeyList(partial.authorityKeys, "OptimizationPolicy.authorityKeys")
    ),
    comparatorVersion,
    quantizeScale: requirePositiveInt(
      partial.quantizeScale ?? 1,
      "OptimizationPolicy.quantizeScale",
      OPTIMIZATION_FAILURE_CODE.INVALID_POLICY
    ),
  });
}
