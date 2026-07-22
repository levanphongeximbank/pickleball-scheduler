/**
 * CORE-10 Phase 1C-A — ObjectiveExecutionSpec contract.
 * Policy-owned execution settings. Order = array index in evaluateObjectives.
 * No numeric `order` field. No skip / diagnostics-only failure policy.
 */

import { OBJECTIVE_EVALUATION_FAILURE_CODE } from "../enums/objectiveEvaluationFailureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { deepFreezeCanonical } from "../deterministic/canonicalize.js";
import { rejectUnknownFields, requireStableId } from "./shared.js";

const ALLOWED = Object.freeze([
  "objectiveId",
  "objectiveVersion",
  "weight",
  "quantizeScale",
]);

const FAIL = OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_EXECUTION_SPEC;

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requirePositiveSafeInt(value, field) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new OptimizerContractError(
      FAIL,
      `${field} must be a positive safe integer`,
      { field, value: value ?? null }
    );
  }
  return value;
}

/**
 * @param {object} [partial]
 * @returns {Readonly<{
 *   objectiveId: string,
 *   objectiveVersion: string,
 *   weight: number,
 *   quantizeScale: number,
 * }>}
 */
export function createObjectiveExecutionSpec(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "ObjectiveExecutionSpec",
    FAIL
  );

  return /** @type {Readonly<object>} */ (
    deepFreezeCanonical(
      {
        objectiveId: requireStableId(
          partial.objectiveId,
          "ObjectiveExecutionSpec.objectiveId",
          FAIL
        ),
        objectiveVersion: requireStableId(
          partial.objectiveVersion,
          "ObjectiveExecutionSpec.objectiveVersion",
          FAIL
        ),
        weight: requirePositiveSafeInt(
          partial.weight,
          "ObjectiveExecutionSpec.weight"
        ),
        quantizeScale: requirePositiveSafeInt(
          partial.quantizeScale,
          "ObjectiveExecutionSpec.quantizeScale"
        ),
      },
      "ObjectiveExecutionSpec"
    )
  );
}
