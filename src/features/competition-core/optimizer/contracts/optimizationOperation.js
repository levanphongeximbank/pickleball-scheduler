/**
 * CORE-10 — OptimizationOperation contract.
 */

import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { resolveOptimizationOperation } from "../enums/optimizationOperation.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { cloneFreezeObject, rejectUnknownFields } from "./shared.js";

const ALLOWED = Object.freeze(["operationId", "params"]);

/**
 * @param {object} partial
 * @returns {Readonly<{ operationId: string, params: Readonly<Record<string, unknown>> }>}
 */
export function createOptimizationOperation(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "OptimizationOperation",
    OPTIMIZATION_FAILURE_CODE.INVALID_OPERATION
  );

  const resolved = resolveOptimizationOperation(partial.operationId);
  if (!resolved.ok) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_OPERATION,
      `Unsupported or missing operationId: ${partial.operationId}`,
      { operationId: partial.operationId ?? null, reason: resolved.reason }
    );
  }

  return Object.freeze({
    operationId: resolved.operationId,
    params: cloneFreezeObject(partial.params || {}, "OptimizationOperation.params"),
  });
}
