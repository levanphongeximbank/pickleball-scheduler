/**
 * CORE-10 — OptimizationFailure contract.
 */

import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { resolveOptimizationFailureCode } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { cloneFreezeObject, rejectUnknownFields, requireStableId } from "./shared.js";

const ALLOWED = Object.freeze(["code", "message", "details"]);

/**
 * @param {object} partial
 * @returns {Readonly<{ code: string, message: string, details: Readonly<Record<string, unknown>> }>}
 */
export function createOptimizationFailure(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "OptimizationFailure",
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );

  const resolved = resolveOptimizationFailureCode(partial.code);
  if (!resolved.ok) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      `Unknown failure code: ${partial.code}`,
      { code: partial.code ?? null }
    );
  }

  const message = requireStableId(
    partial.message,
    "OptimizationFailure.message",
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );

  return Object.freeze({
    code: resolved.code,
    message,
    details: cloneFreezeObject(partial.details || {}, "OptimizationFailure.details"),
  });
}
