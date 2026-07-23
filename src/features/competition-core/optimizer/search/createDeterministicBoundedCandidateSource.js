/**
 * CORE-10 Phase 1L — Deterministic Bounded Candidate Source factory.
 *
 * Wraps searchDeterministicCandidates behind the existing CandidateSourcePort.
 * Search diagnostics are not exposed through the port (port contract unchanged).
 * sourceContext is accepted for port compatibility and is not used.
 */

import { CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1 } from "../constants/versions.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { createCandidateSourcePort } from "../ports/candidateSourcePort.js";
import { createDeterministicBoundedSearchSpec } from "./deterministicBoundedSearchSpec.js";
import { searchDeterministicCandidates } from "./searchDeterministicCandidates.js";

const FAIL = OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST;

const DEFAULT_PORT_ID = "CORE10_DETERMINISTIC_BOUNDED_SEARCH";

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
 * Create a CandidateSourcePort that runs deterministic bounded search once
 * and emits the structural CandidateBatch only.
 *
 * @param {unknown} searchSpec
 * @returns {Readonly<{
 *   portId: string,
 *   portVersion: string,
 *   produce: (request?: unknown, sourceContext?: unknown) => Readonly<object>,
 * }>}
 */
export function createDeterministicBoundedCandidateSource(searchSpec) {
  if (isThenable(searchSpec)) {
    throw new OptimizerContractError(
      FAIL,
      "DeterministicBoundedCandidateSource searchSpec must not be a Promise/thenable",
      {}
    );
  }
  if (searchSpec === undefined || searchSpec === null) {
    throw new OptimizerContractError(
      FAIL,
      "DeterministicBoundedCandidateSource searchSpec is required",
      { searchSpec: searchSpec ?? null }
    );
  }
  if (!isPlainObject(searchSpec)) {
    throw new OptimizerContractError(
      FAIL,
      "DeterministicBoundedCandidateSource searchSpec must be a plain object",
      {}
    );
  }

  const closedSpec = createDeterministicBoundedSearchSpec(
    /** @type {object} */ (searchSpec)
  );

  return createCandidateSourcePort({
    portId: DEFAULT_PORT_ID,
    portVersion: CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1,
    produce(request) {
      // sourceContext intentionally unused — search binds request + closed Spec only.
      // Diagnostics remain on searchDeterministicCandidates / certified entry only.
      return searchDeterministicCandidates(request, closedSpec).candidateBatch;
    },
  });
}
