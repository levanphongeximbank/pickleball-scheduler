/**
 * CORE-10 — score construction helpers and lexicographic comparison.
 * displayTotal never controls ranking. candidateId is final tie-break only.
 */

import { CORE10_COMPARATOR_VERSION } from "../constants/versions.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OBJECTIVE_SENSE } from "../enums/constraintKind.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { compareStableId } from "../deterministic/compare.js";
import { createOptimizationScore } from "../contracts/optimizationScore.js";

/**
 * Orient a raw objective value so that lower is always better for ranking.
 * @param {number} value
 * @param {string} sense
 * @returns {number}
 */
export function orientObjectiveValue(value, sense) {
  if (sense === OBJECTIVE_SENSE.MAXIMIZE) {
    return -value;
  }
  if (sense === OBJECTIVE_SENSE.MINIMIZE) {
    return value;
  }
  throw new OptimizerContractError(
    OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
    `Unknown objective sense: ${sense}`,
    { sense }
  );
}

/**
 * Build a rankable score from a candidate + policy.
 * Soft scores never compensate hard violations.
 *
 * @param {object} args
 * @param {object} args.candidate — CandidateSolution-like
 * @param {object} args.policy — OptimizationPolicy
 * @param {Record<string, number>} [args.authorityValueByKey]
 * @param {number|null} [args.displayTotal]
 * @returns {ReturnType<typeof createOptimizationScore>}
 */
export function buildOptimizationScore({
  candidate,
  policy,
  authorityValueByKey = {},
  displayTotal = null,
}) {
  if (!candidate || !policy) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
      "buildOptimizationScore requires candidate and policy",
      {}
    );
  }

  const feasible = Boolean(candidate.feasible);
  const hardViolationCount = Number(candidate.hardViolationCount ?? 0);

  /** @type {Map<string, { value: number, sense: string }>} */
  const objMap = new Map();
  for (const ev of candidate.objectiveEvaluations || []) {
    objMap.set(ev.objectiveKey, { value: ev.value, sense: ev.sense });
  }

  const objectiveValues = policy.objectiveKeys.map((key) => {
    const found = objMap.get(key);
    if (!found) {
      // Missing objective → worst quantized sentinel for ranking (large positive after orient).
      return Number.MAX_SAFE_INTEGER;
    }
    return orientObjectiveValue(found.value, found.sense);
  });

  const authorityValues = (policy.authorityKeys || []).map((key) => {
    const v = authorityValueByKey[key];
    if (typeof v !== "number" || !Number.isInteger(v) || !Number.isFinite(v)) {
      return Number.MAX_SAFE_INTEGER;
    }
    return v;
  });

  return createOptimizationScore({
    feasible,
    hardViolationCount: feasible ? 0 : Math.max(1, hardViolationCount),
    authorityValues,
    objectiveValues,
    displayTotal,
    comparatorVersion: policy.comparatorVersion || CORE10_COMPARATOR_VERSION,
    candidateId: candidate.candidateId,
  });
}

/**
 * Lexicographic score comparison per CORE10_COMPARATOR_V1.
 * @param {object} a — OptimizationScore
 * @param {object} b — OptimizationScore
 * @returns {number} negative if a ranks better than b
 */
export function compareOptimizationScores(a, b) {
  if (!a || !b) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
      "compareOptimizationScores requires two scores",
      {}
    );
  }

  // 1. Feasible before infeasible
  if (a.feasible !== b.feasible) {
    return a.feasible ? -1 : 1;
  }

  // 2. Hard violations never compensated by soft scores
  if (a.hardViolationCount !== b.hardViolationCount) {
    return a.hardViolationCount - b.hardViolationCount;
  }

  // 3. Authority / priority keys
  const authLen = Math.max(
    a.authorityValues?.length ?? 0,
    b.authorityValues?.length ?? 0
  );
  for (let i = 0; i < authLen; i += 1) {
    const av = a.authorityValues?.[i] ?? Number.MAX_SAFE_INTEGER;
    const bv = b.authorityValues?.[i] ?? Number.MAX_SAFE_INTEGER;
    if (av !== bv) return av - bv;
  }

  // 4. Objective keys in declared order (already oriented: lower better)
  const objLen = Math.max(
    a.objectiveValues?.length ?? 0,
    b.objectiveValues?.length ?? 0
  );
  for (let i = 0; i < objLen; i += 1) {
    const av = a.objectiveValues?.[i] ?? Number.MAX_SAFE_INTEGER;
    const bv = b.objectiveValues?.[i] ?? Number.MAX_SAFE_INTEGER;
    if (av !== bv) return av - bv;
  }

  // displayTotal intentionally ignored

  // 5. Stable candidate ID final tie-break
  return compareStableId(a.candidateId, b.candidateId);
}

/**
 * Sort candidates by score. Does not mutate input. Equal inputs ⇒ identical order.
 * @param {readonly object[]} scores
 * @returns {object[]}
 */
export function sortScoresDeterministic(scores) {
  const out = Array.isArray(scores) ? [...scores] : [];
  out.sort(compareOptimizationScores);
  return out;
}
