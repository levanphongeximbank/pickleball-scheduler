/**
 * CORE-10 Phase 1C-A — synchronous deterministic single-objective evaluation.
 *
 * Required context semantics:
 *   evaluationInput.contexts is a plain object container.
 *   Each requiredContextRef must be an own property of contexts.
 *   Own property with value `undefined` counts as missing.
 *   Prototype-chain properties do not satisfy required context.
 */

import { OBJECTIVE_EVALUATION_FAILURE_CODE } from "../enums/objectiveEvaluationFailureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { deepFreezeCanonical, isPlainObject } from "../deterministic/canonicalize.js";
import { compareStableString } from "../deterministic/compare.js";
import { OBJECTIVE_NORMALIZATION_POLICY } from "../contracts/objectiveDefinition.js";
import { createObjectiveExecutionSpec } from "../contracts/objectiveExecutionSpec.js";
import { createObjectiveEvaluationRecord } from "../contracts/objectiveEvaluationRecord.js";
import { orientObjectiveValue } from "../scoring/compareScores.js";

const EVALUATOR_RESULT_ALLOWED = Object.freeze(["rawValue", "noteCodes"]);

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
 * @param {number} value
 * @returns {number}
 */
function positiveZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

/**
 * @param {number} a
 * @param {number} b
 * @param {string} field
 * @returns {number}
 */
function checkedMultiplySafeInt(a, b, field) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_SCORE_OVERFLOW,
      `${field} multiplication operands must be finite`,
      { field, a, b }
    );
  }
  const product = a * b;
  if (!Number.isFinite(product) || !Number.isSafeInteger(product)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_SCORE_OVERFLOW,
      `${field} multiplication overflowed safe integer range`,
      {
        field,
        a,
        b,
        product: Number.isFinite(product) ? product : String(product),
      }
    );
  }
  return positiveZero(product);
}

/**
 * @param {unknown} codes
 * @returns {string[]}
 */
function normalizeEvaluatorNoteCodes(codes) {
  if (codes == null) return [];
  if (!Array.isArray(codes)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_EVALUATOR_RESULT,
      "evaluator noteCodes must be an array of stable strings",
      {}
    );
  }
  // Copy before sort — never mutate evaluator-owned array.
  const source = codes.slice();
  const out = [];
  const seen = new Set();
  for (let i = 0; i < source.length; i += 1) {
    const code = source[i];
    if (typeof code !== "string" || code.trim() === "") {
      throw new OptimizerContractError(
        OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_EVALUATOR_RESULT,
        `evaluator noteCodes[${i}] must be a non-empty stable string`,
        { index: i }
      );
    }
    const trimmed = code.trim();
    if (seen.has(trimmed)) {
      throw new OptimizerContractError(
        OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_EVALUATOR_RESULT,
        `Duplicate evaluator noteCodes entry: ${trimmed}`,
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
 * Copy evaluator output before transformation. Strict allowlist.
 * @param {unknown} result
 * @returns {{ rawValue: number, noteCodes: string[] }}
 */
function validateEvaluatorResult(result) {
  if (!isPlainObject(result)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_EVALUATOR_RESULT,
      "evaluator result must be a plain object { rawValue, noteCodes? }",
      {}
    );
  }
  // Own keys only.
  const keys = Object.keys(/** @type {Record<string, unknown>} */ (result));
  const allowed = new Set(EVALUATOR_RESULT_ALLOWED);
  const unknown = keys.filter((k) => !allowed.has(k));
  if (unknown.length > 0) {
    unknown.sort(compareStableString);
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_EVALUATOR_RESULT,
      `evaluator result has unknown fields: ${unknown.join(", ")}`,
      { unknown }
    );
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      /** @type {object} */ (result),
      "rawValue"
    )
  ) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_EVALUATOR_RESULT,
      "evaluator result missing rawValue",
      {}
    );
  }

  const rawValue = /** @type {Record<string, unknown>} */ (result).rawValue;
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.NON_FINITE_OBJECTIVE_VALUE,
      "evaluator rawValue must be a finite number",
      { rawValue: rawValue == null ? null : String(rawValue) }
    );
  }

  const noteCodesRaw = Object.prototype.hasOwnProperty.call(
    /** @type {object} */ (result),
    "noteCodes"
  )
    ? /** @type {Record<string, unknown>} */ (result).noteCodes
    : undefined;

  return {
    rawValue: positiveZero(rawValue),
    noteCodes: normalizeEvaluatorNoteCodes(noteCodesRaw),
  };
}

/**
 * Own-property-only context resolution against evaluationInput.contexts.
 * @param {object} definition
 * @param {unknown} evaluationInput
 */
function assertRequiredContext(definition, evaluationInput) {
  const required = definition.requiredContextRefs || [];
  if (required.length === 0) return;

  if (evaluationInput == null || !isPlainObject(evaluationInput)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.MISSING_OBJECTIVE_CONTEXT,
      "evaluationInput.contexts plain object required for this objective",
      {
        objectiveId: definition.objectiveId,
        requiredContextRefs: [...required],
      }
    );
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      /** @type {object} */ (evaluationInput),
      "contexts"
    )
  ) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.MISSING_OBJECTIVE_CONTEXT,
      "evaluationInput.contexts required for this objective",
      {
        objectiveId: definition.objectiveId,
        requiredContextRefs: [...required],
      }
    );
  }

  const contexts = /** @type {Record<string, unknown>} */ (evaluationInput).contexts;
  if (!isPlainObject(contexts)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.MISSING_OBJECTIVE_CONTEXT,
      "evaluationInput.contexts must be a plain object",
      {
        objectiveId: definition.objectiveId,
        requiredContextRefs: [...required],
      }
    );
  }

  /** @type {string[]} */
  const missing = [];
  for (const ref of required) {
    if (!Object.prototype.hasOwnProperty.call(contexts, ref)) {
      missing.push(ref);
      continue;
    }
    // Own property present but undefined counts as missing.
    if (contexts[ref] === undefined) {
      missing.push(ref);
    }
  }

  if (missing.length > 0) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.MISSING_OBJECTIVE_CONTEXT,
      `Missing required context refs: ${missing.join(", ")}`,
      {
        objectiveId: definition.objectiveId,
        missing,
        requiredContextRefs: [...required],
      }
    );
  }
}

/**
 * @param {object} definition
 * @param {number} rawValue
 * @returns {number}
 */
function normalizeValue(definition, rawValue) {
  if (definition.normalizationPolicy !== OBJECTIVE_NORMALIZATION_POLICY.NONE) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.UNSUPPORTED_NORMALIZATION_POLICY,
      `Unsupported normalizationPolicy: ${definition.normalizationPolicy}`,
      { normalizationPolicy: definition.normalizationPolicy }
    );
  }
  return positiveZero(rawValue);
}

/**
 * Evaluate a single objective synchronously.
 *
 * @param {object} args
 * @param {{ resolve: Function }} args.registry
 * @param {object} args.executionSpec
 * @param {unknown} [args.evaluationInput]
 * @param {number} args.executionIndex
 * @returns {Readonly<object>}
 */
export function evaluateObjective({
  registry,
  executionSpec,
  evaluationInput = {},
  executionIndex,
}) {
  if (!registry || typeof registry.resolve !== "function") {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.UNKNOWN_OBJECTIVE,
      "evaluateObjective requires an objective registry",
      {}
    );
  }

  if (
    typeof executionIndex !== "number" ||
    !Number.isSafeInteger(executionIndex) ||
    executionIndex < 0
  ) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_EXECUTION_SPEC,
      "executionIndex must be a non-negative safe integer",
      { executionIndex: executionIndex ?? null }
    );
  }

  // 1–2. Validate execution spec (owned clone inside factory).
  const spec = createObjectiveExecutionSpec(executionSpec);

  // 3. Resolve exact objective ID and version.
  const resolved = registry.resolve(spec.objectiveId, spec.objectiveVersion);
  const { definition, evaluator } = resolved;

  if (typeof evaluator !== "function") {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATOR_MISSING,
      "Resolved evaluator is missing",
      {
        objectiveId: definition.objectiveId,
        objectiveVersion: definition.objectiveVersion,
      }
    );
  }

  // 4. Required context — own-property checks on caller input (no mutation).
  assertRequiredContext(definition, evaluationInput);

  // 5. Owned frozen replay-safe evaluator input (never freeze caller object).
  const frozenInput = deepFreezeCanonical(
    evaluationInput == null ? {} : evaluationInput,
    "evaluationInput"
  );

  // 6. Call evaluator exactly once.
  let rawResult;
  try {
    rawResult = evaluator({
      definition,
      executionSpec: spec,
      evaluationInput: frozenInput,
    });
  } catch (err) {
    if (err instanceof OptimizerContractError) {
      throw err;
    }
    // Exception message/stack must not enter replay-safe output.
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATOR_EXCEPTION,
      "Objective evaluator threw an exception",
      {
        objectiveId: definition.objectiveId,
        objectiveVersion: definition.objectiveVersion,
        evaluatorRef: definition.evaluatorRef,
      }
    );
  }

  // 7. Reject Promise/thenable before normal result validation.
  if (isThenable(rawResult)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.ASYNC_OBJECTIVE_EVALUATOR_UNSUPPORTED,
      "Async objective evaluators are unsupported in Phase 1C-A",
      {
        objectiveId: definition.objectiveId,
        evaluatorRef: definition.evaluatorRef,
      }
    );
  }

  // 8. Validate + copy evaluator output.
  const { rawValue, noteCodes } = validateEvaluatorResult(rawResult);

  // 9. Normalize (NONE).
  const normalizedValue = normalizeValue(definition, rawValue);

  // 10. Quantize — check finite before multiply, after multiply, after round.
  if (!Number.isFinite(normalizedValue) || !Number.isFinite(spec.quantizeScale)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_SCORE_OVERFLOW,
      "quantize operands must be finite",
      { normalizedValue, quantizeScale: spec.quantizeScale }
    );
  }
  const scaleProduct = normalizedValue * spec.quantizeScale;
  if (!Number.isFinite(scaleProduct)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_SCORE_OVERFLOW,
      "quantize scale product is non-finite",
      { normalizedValue, quantizeScale: spec.quantizeScale }
    );
  }
  const quantizedValue = positiveZero(Math.round(scaleProduct));
  if (!Number.isSafeInteger(quantizedValue)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_SCORE_OVERFLOW,
      "quantizedValue overflowed safe integer range",
      {
        normalizedValue,
        quantizeScale: spec.quantizeScale,
        quantizedValue: Number.isFinite(quantizedValue)
          ? quantizedValue
          : String(quantizedValue),
      }
    );
  }

  // 11. Weight.
  const weightedValue = checkedMultiplySafeInt(
    quantizedValue,
    spec.weight,
    "weightedValue"
  );

  // 12. Orient.
  let orientedValue;
  try {
    orientedValue = positiveZero(
      orientObjectiveValue(weightedValue, definition.direction)
    );
  } catch {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_EVALUATOR_RESULT,
      `Unable to orient objective value for direction ${definition.direction}`,
      { direction: definition.direction }
    );
  }
  if (!Number.isSafeInteger(orientedValue)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_SCORE_OVERFLOW,
      "orientedValue overflowed safe integer range",
      { weightedValue, direction: definition.direction }
    );
  }

  // 13. Immutable record.
  return createObjectiveEvaluationRecord({
    objectiveId: definition.objectiveId,
    objectiveVersion: definition.objectiveVersion,
    evaluatorRef: definition.evaluatorRef,
    direction: definition.direction,
    executionIndex,
    rawValue,
    normalizedValue,
    quantizedValue,
    weightedValue,
    orientedValue,
    noteCodes,
  });
}
