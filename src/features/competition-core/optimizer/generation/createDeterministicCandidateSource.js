/**
 * CORE-10 Phase 1J — Deterministic Candidate Source factory.
 *
 * Wraps generateCandidateBatch behind the existing CandidateSourcePort.
 * sourceContext is accepted for port compatibility and is not used.
 */

import { CORE10_DETERMINISTIC_CANDIDATE_GENERATOR_V1 } from "../constants/versions.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { rejectUnknownFields, requireStableId } from "../contracts/shared.js";
import { createCandidateSourcePort } from "../ports/candidateSourcePort.js";
import { createDeterministicCandidateGenerationSpec } from "./deterministicCandidateGenerationSpec.js";
import { generateCandidateBatch } from "./generateCandidateBatch.js";

const FAIL = OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST;

const FACTORY_ALLOWED = Object.freeze(["portId", "portVersion", "spec"]);

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
 * Create a CandidateSourcePort that deterministically generates a Candidate
 * Batch from a closed-over Generation Spec.
 *
 * @param {object} [partial]
 * @returns {Readonly<{
 *   portId: string,
 *   portVersion: string,
 *   produce: (request?: unknown, sourceContext?: unknown) => Readonly<object>,
 * }>}
 */
export function createDeterministicCandidateSource(partial = {}) {
  if (isThenable(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "DeterministicCandidateSource must not be a Promise/thenable",
      {}
    );
  }
  if (!isPlainObject(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "DeterministicCandidateSource must be a plain object",
      {}
    );
  }

  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    FACTORY_ALLOWED,
    "DeterministicCandidateSource",
    FAIL
  );

  const portId = requireStableId(
    ownValue(partial, "portId"),
    "DeterministicCandidateSource.portId",
    FAIL
  );

  const portVersion = requireStableId(
    ownValue(partial, "portVersion") ??
      CORE10_DETERMINISTIC_CANDIDATE_GENERATOR_V1,
    "DeterministicCandidateSource.portVersion",
    FAIL
  );

  if (!Object.prototype.hasOwnProperty.call(partial, "spec")) {
    throw new OptimizerContractError(
      FAIL,
      "DeterministicCandidateSource.spec is required",
      { portId }
    );
  }

  const closedSpec = createDeterministicCandidateGenerationSpec(
    ownValue(partial, "spec")
  );

  return createCandidateSourcePort({
    portId,
    portVersion,
    produce(request) {
      // sourceContext is intentionally unused — generation binds only request + closed Spec.
      return generateCandidateBatch(request, closedSpec);
    },
  });
}
