/**
 * CORE-10 — SolverDiagnostics contract (serializable; not persistence-wired).
 */

import { CORE10_COMPARATOR_VERSION, CORE10_FINGERPRINT_VERSION } from "../constants/versions.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import {
  cloneFreezeObject,
  rejectUnknownFields,
  requireBoolean,
  requireNonNegativeInt,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "validationFailures",
  "candidateCount",
  "feasibleCount",
  "infeasibleCount",
  "prunedCount",
  "budgetUsage",
  "budgetExhausted",
  "watchdogTimeout",
  "comparatorVersion",
  "fingerprintAlgorithmVersion",
  "nonReplay",
]);

const BUDGET_USAGE_ALLOWED = Object.freeze([
  "nodes",
  "candidates",
  "evaluations",
]);

const NON_REPLAY_ALLOWED = Object.freeze([
  "wallClockDurationMs",
  "machineIdentity",
  "timestamp",
  "processId",
  "memoryUsage",
  "runtimeTiming",
]);

/**
 * @param {object} usage
 * @returns {Readonly<object>}
 */
function createBudgetUsage(usage = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (usage),
    BUDGET_USAGE_ALLOWED,
    "SolverDiagnostics.budgetUsage",
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  return Object.freeze({
    nodes: requireNonNegativeInt(
      usage.nodes ?? 0,
      "budgetUsage.nodes",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    candidates: requireNonNegativeInt(
      usage.candidates ?? 0,
      "budgetUsage.candidates",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    evaluations: requireNonNegativeInt(
      usage.evaluations ?? 0,
      "budgetUsage.evaluations",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
  });
}

/**
 * Non-replay diagnostics only — never included in replay fingerprints.
 * @param {object} partial
 * @returns {Readonly<object>}
 */
function createNonReplayDiagnostics(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    NON_REPLAY_ALLOWED,
    "SolverDiagnostics.nonReplay",
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  return cloneFreezeObject(partial, "SolverDiagnostics.nonReplay");
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createSolverDiagnostics(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "SolverDiagnostics",
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );

  const validationFailures = Array.isArray(partial.validationFailures)
    ? partial.validationFailures.map((f, i) => {
        if (!f || typeof f !== "object") {
          throw new OptimizerContractError(
            OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
            `validationFailures[${i}] must be an object`,
            { index: i }
          );
        }
        return cloneFreezeObject(f, `validationFailures[${i}]`);
      })
    : [];

  return Object.freeze({
    validationFailures: Object.freeze(validationFailures),
    candidateCount: requireNonNegativeInt(
      partial.candidateCount ?? 0,
      "candidateCount",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    feasibleCount: requireNonNegativeInt(
      partial.feasibleCount ?? 0,
      "feasibleCount",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    infeasibleCount: requireNonNegativeInt(
      partial.infeasibleCount ?? 0,
      "infeasibleCount",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    prunedCount: requireNonNegativeInt(
      partial.prunedCount ?? 0,
      "prunedCount",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    budgetUsage: createBudgetUsage(partial.budgetUsage || {}),
    budgetExhausted: requireBoolean(
      partial.budgetExhausted ?? false,
      "budgetExhausted",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    watchdogTimeout: requireBoolean(
      partial.watchdogTimeout ?? false,
      "watchdogTimeout",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    comparatorVersion: String(
      partial.comparatorVersion ?? CORE10_COMPARATOR_VERSION
    ),
    fingerprintAlgorithmVersion: String(
      partial.fingerprintAlgorithmVersion ?? CORE10_FINGERPRINT_VERSION
    ),
    nonReplay: createNonReplayDiagnostics(partial.nonReplay || {}),
  });
}
