/**
 * CORE-10 Phase 1C-A — ObjectiveEvaluationRecord (replay-safe).
 * Sibling to Phase 1B ObjectiveEvaluation — do not replace that contract.
 * No free-text display messages.
 */

import { OBJECTIVE_SENSE, isObjectiveSense } from "../enums/constraintKind.js";
import { OBJECTIVE_EVALUATION_FAILURE_CODE } from "../enums/objectiveEvaluationFailureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { compareStableString } from "../deterministic/compare.js";
import { deepFreezeCanonical } from "../deterministic/canonicalize.js";
import { rejectUnknownFields, requireStableId } from "./shared.js";

const ALLOWED = Object.freeze([
  "objectiveId",
  "objectiveVersion",
  "evaluatorRef",
  "direction",
  "executionIndex",
  "rawValue",
  "normalizedValue",
  "quantizedValue",
  "weightedValue",
  "orientedValue",
  "noteCodes",
]);

const FAIL = OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_EVALUATOR_RESULT;

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requireFiniteNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.NON_FINITE_OBJECTIVE_VALUE,
      `${field} must be a finite number`,
      { field, value: value == null ? null : String(value) }
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requireSafeInt(value, field) {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.UNSAFE_OBJECTIVE_INTEGER,
      `${field} must be a safe integer`,
      { field, value: value ?? null }
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requireNonNegativeSafeInt(value, field) {
  const n = requireSafeInt(value, field);
  if (n < 0) {
    throw new OptimizerContractError(
      FAIL,
      `${field} must be a non-negative safe integer`,
      { field, value: n }
    );
  }
  return n;
}

/**
 * Duplicate note codes are rejected (fail-closed). Surviving codes are
 * stored in deterministic stable string order.
 * @param {unknown} codes
 * @returns {string[]}
 */
function normalizeNoteCodes(codes) {
  if (codes == null) return [];
  if (!Array.isArray(codes)) {
    throw new OptimizerContractError(
      FAIL,
      "noteCodes must be an array of stable strings",
      {}
    );
  }
  const out = [];
  const seen = new Set();
  for (let i = 0; i < codes.length; i += 1) {
    const code = codes[i];
    if (typeof code !== "string" || code.trim() === "") {
      throw new OptimizerContractError(
        FAIL,
        `noteCodes[${i}] must be a non-empty stable string`,
        { index: i }
      );
    }
    const trimmed = code.trim();
    if (seen.has(trimmed)) {
      throw new OptimizerContractError(
        FAIL,
        `Duplicate noteCodes entry: ${trimmed}`,
        { code: trimmed }
      );
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  out.sort(compareStableString);
  return out;
}

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createObjectiveEvaluationRecord(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "ObjectiveEvaluationRecord",
    FAIL
  );

  if (!isObjectiveSense(partial.direction)) {
    throw new OptimizerContractError(
      FAIL,
      `Invalid ObjectiveEvaluationRecord.direction: ${partial.direction}`,
      {
        direction: partial.direction ?? null,
        allowed: [OBJECTIVE_SENSE.MINIMIZE, OBJECTIVE_SENSE.MAXIMIZE],
      }
    );
  }

  return /** @type {Readonly<object>} */ (
    deepFreezeCanonical(
      {
        objectiveId: requireStableId(
          partial.objectiveId,
          "ObjectiveEvaluationRecord.objectiveId",
          FAIL
        ),
        objectiveVersion: requireStableId(
          partial.objectiveVersion,
          "ObjectiveEvaluationRecord.objectiveVersion",
          FAIL
        ),
        evaluatorRef: requireStableId(
          partial.evaluatorRef,
          "ObjectiveEvaluationRecord.evaluatorRef",
          FAIL
        ),
        direction: partial.direction,
        executionIndex: requireNonNegativeSafeInt(
          partial.executionIndex,
          "ObjectiveEvaluationRecord.executionIndex"
        ),
        rawValue: requireFiniteNumber(
          partial.rawValue,
          "ObjectiveEvaluationRecord.rawValue"
        ),
        normalizedValue: requireFiniteNumber(
          partial.normalizedValue,
          "ObjectiveEvaluationRecord.normalizedValue"
        ),
        quantizedValue: requireSafeInt(
          partial.quantizedValue,
          "ObjectiveEvaluationRecord.quantizedValue"
        ),
        weightedValue: requireSafeInt(
          partial.weightedValue,
          "ObjectiveEvaluationRecord.weightedValue"
        ),
        orientedValue: requireSafeInt(
          partial.orientedValue,
          "ObjectiveEvaluationRecord.orientedValue"
        ),
        noteCodes: normalizeNoteCodes(partial.noteCodes),
      },
      "ObjectiveEvaluationRecord"
    )
  );
}
