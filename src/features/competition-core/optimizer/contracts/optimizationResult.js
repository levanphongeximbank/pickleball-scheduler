/**
 * CORE-10 — OptimizationResult contract.
 */

import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { resolveOptimizationStatus, OPTIMIZATION_STATUS } from "../enums/optimizationStatus.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { createOptimizationFailure } from "./optimizationFailure.js";
import { createReplayMetadata } from "./replayMetadata.js";
import { createSolverDiagnostics } from "./solverDiagnostics.js";
import {
  rejectUnknownFields,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "status",
  "requestId",
  "selectedCandidateId",
  "rankedCandidateIds",
  "failure",
  "diagnostics",
  "replayMetadata",
  "resultFingerprint",
]);

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createOptimizationResult(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "OptimizationResult",
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );

  const statusResolved = resolveOptimizationStatus(partial.status);
  if (!statusResolved.ok) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      `Invalid optimization status: ${partial.status}`,
      { status: partial.status ?? null }
    );
  }
  const status = statusResolved.status;

  if (!Array.isArray(partial.rankedCandidateIds)) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      "rankedCandidateIds must be an array",
      {}
    );
  }
  const rankedCandidateIds = Object.freeze(
    partial.rankedCandidateIds.map((id, i) =>
      requireStableId(
        id,
        `rankedCandidateIds[${i}]`,
        OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
      )
    )
  );

  if (!partial.diagnostics || typeof partial.diagnostics !== "object") {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      "diagnostics is required",
      {}
    );
  }
  const diagnostics = createSolverDiagnostics(partial.diagnostics);

  if (!partial.replayMetadata || typeof partial.replayMetadata !== "object") {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      "replayMetadata is required",
      {}
    );
  }
  const replayMetadata = createReplayMetadata(partial.replayMetadata);

  const resultFingerprint = requireStableId(
    partial.resultFingerprint ?? replayMetadata.resultFingerprint,
    "resultFingerprint",
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );

  let selectedCandidateId = null;
  if (partial.selectedCandidateId != null) {
    selectedCandidateId = requireStableId(
      partial.selectedCandidateId,
      "selectedCandidateId",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    );
  }

  let failure = null;
  if (partial.failure != null) {
    failure = createOptimizationFailure(partial.failure);
  }

  // Fail closed: SUCCESS requires a selected feasible candidate id.
  if (status === OPTIMIZATION_STATUS.SUCCESS) {
    if (!selectedCandidateId) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INFEASIBLE,
        "SUCCESS requires selectedCandidateId; do not expose partial success without a feasible candidate",
        {}
      );
    }
    if (failure) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
        "SUCCESS result must not include failure",
        {}
      );
    }
    if (diagnostics.watchdogTimeout || diagnostics.budgetExhausted) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
        "SUCCESS cannot be replay-certified when watchdogTimeout or budgetExhausted is true",
        {}
      );
    }
  } else if (!failure) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      `Non-success status ${status} requires failure`,
      { status }
    );
  }

  return Object.freeze({
    status,
    requestId: requireStableId(
      partial.requestId,
      "requestId",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    selectedCandidateId,
    rankedCandidateIds,
    failure,
    diagnostics,
    replayMetadata,
    resultFingerprint,
  });
}
