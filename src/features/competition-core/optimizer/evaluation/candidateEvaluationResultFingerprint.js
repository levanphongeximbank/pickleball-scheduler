/**
 * CORE-10 Phase 1C-C — CandidateEvaluationResult content fingerprint.
 * Replay-safe envelope material only. Explicit utility — does not attach
 * resultFingerprint onto CandidateEvaluationResult or alter orchestration.
 */

import { CORE10_CANDIDATE_RESULT_FINGERPRINT_VERSION } from "../constants/versions.js";
import { CANDIDATE_EVALUATION_FAILURE_CODE } from "../enums/candidateEvaluationFailureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { fingerprintValue } from "../deterministic/fingerprint.js";
import { createCandidateEvaluationResult } from "../contracts/candidateEvaluationResult.js";

const FAIL =
  CANDIDATE_EVALUATION_FAILURE_CODE
    .INVALID_CANDIDATE_EVALUATION_RESULT_FINGERPRINT_INPUT;

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
 * @param {object} obj
 * @param {string} key
 * @returns {unknown}
 */
function ownValue(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

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
 * Shallow own-property clone for revalidation. Does not mutate or freeze caller.
 * Nested values are re-owned by createCandidateEvaluationResult.
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
 * @param {Readonly<object>} validated
 * @returns {object}
 */
function buildCandidateEvaluationResultFingerprintMaterial(validated) {
  return {
    resultFingerprintVersion: CORE10_CANDIDATE_RESULT_FINGERPRINT_VERSION,
    schemaVersion: validated.schemaVersion,
    evaluationVersion: validated.evaluationVersion,
    candidateId: validated.candidateId,
    operation: validated.operation,
    status: validated.status,
    feasible: validated.feasible,
    // Preserve emitted array orders — do not sort material arrays.
    structuralViolations: validated.structuralViolations,
    businessViolations: validated.businessViolations,
    allHardViolations: validated.allHardViolations,
    objectiveEvaluations: validated.objectiveEvaluations,
    optimizationScore: validated.optimizationScore,
    failure: validated.failure,
    portDescriptor: validated.portDescriptor,
    inputFingerprint: validated.inputFingerprint,
  };
}

/**
 * Deterministic fingerprint of a validated CandidateEvaluationResult envelope.
 *
 * @param {unknown} result
 * @returns {string}
 */
export function createCandidateEvaluationResultFingerprint(result) {
  if (result === undefined) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationResult fingerprint input must not be undefined",
      {}
    );
  }
  if (typeof result === "function") {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationResult fingerprint input must not be a function",
      {}
    );
  }
  if (result instanceof Error) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationResult fingerprint input must not be an Error",
      {}
    );
  }
  if (isThenable(result)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationResult fingerprint input must not be a Promise/thenable",
      {}
    );
  }
  if (typeof result === "number" && !Number.isFinite(result)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationResult fingerprint input must not be a non-finite number",
      { value: String(result) }
    );
  }
  if (!isPlainObject(result)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationResult fingerprint input must be a plain object",
      {}
    );
  }

  for (const key of RESULT_FIELDS) {
    const v = ownValue(result, key);
    if (typeof v === "function") {
      throw new OptimizerContractError(
        FAIL,
        `CandidateEvaluationResult.${key} must not be a function`,
        { field: key }
      );
    }
    if (isThenable(v)) {
      throw new OptimizerContractError(
        FAIL,
        `CandidateEvaluationResult.${key} must not be a Promise/thenable`,
        { field: key }
      );
    }
    if (v instanceof Error) {
      throw new OptimizerContractError(
        FAIL,
        `CandidateEvaluationResult.${key} must not be an Error`,
        { field: key }
      );
    }
  }

  const ownedInput = buildOwnedRevalidationInput(result);
  // Revalidation fail-closed: never hash lookalike objects.
  // Invalid result shape/status propagates INVALID_CANDIDATE_EVALUATION_RESULT.
  const validated = createCandidateEvaluationResult(ownedInput);
  const material = buildCandidateEvaluationResultFingerprintMaterial(validated);
  return fingerprintValue(material);
}
