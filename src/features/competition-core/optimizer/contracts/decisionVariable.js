/**
 * CORE-10 — DecisionVariable contract.
 */

import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { deepFreezeCanonical } from "../deterministic/canonicalize.js";
import {
  domainValueKey,
  rejectUnknownFields,
  requireBoolean,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "variableId",
  "domain",
  "required",
]);

/**
 * @param {object} partial
 * @returns {Readonly<{
 *   variableId: string,
 *   domain: ReadonlyArray<string|number|boolean|null>,
 *   required: boolean,
 * }>}
 */
export function createDecisionVariable(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "DecisionVariable",
    OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN
  );

  const variableId = requireStableId(
    partial.variableId,
    "DecisionVariable.variableId",
    OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN
  );
  if (!Array.isArray(partial.domain) || partial.domain.length === 0) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN,
      "DecisionVariable.domain must be a non-empty array",
      { variableId }
    );
  }

  const seen = new Set();
  const domain = partial.domain.map((v, i) => {
    const key = domainValueKey(v);
    if (seen.has(key)) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN,
        `Duplicate domain value at index ${i}`,
        { variableId, index: i }
      );
    }
    seen.add(key);
    return /** @type {string|number|boolean|null} */ (
      deepFreezeCanonical(v, `DecisionVariable.domain[${i}]`)
    );
  });

  return Object.freeze({
    variableId,
    domain: Object.freeze(domain),
    required: requireBoolean(
      partial.required,
      "DecisionVariable.required",
      OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN
    ),
  });
}
