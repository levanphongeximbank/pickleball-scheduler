/**
 * CORE-10 Phase 1C-A — ObjectiveDefinition contract.
 * Serializable descriptor only — no evaluator functions, weights, or order.
 * Reads own properties only — inherited values do not satisfy the schema.
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
  "direction",
  "evaluatorRef",
  "requiredContextRefs",
  "normalizationPolicy",
  "metadataCodes",
]);

/** Only NONE is supported in Phase 1C-A. */
export const OBJECTIVE_NORMALIZATION_POLICY = Object.freeze({
  NONE: "NONE",
});

const FAIL = OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_DEFINITION;

/**
 * @param {object} obj
 * @param {string} key
 * @returns {unknown}
 */
function ownValue(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

/**
 * @param {unknown} codes
 * @param {string} field
 * @returns {string[]}
 */
function normalizeStableCodeList(codes, field) {
  if (codes == null) return [];
  if (!Array.isArray(codes)) {
    throw new OptimizerContractError(
      FAIL,
      `${field} must be an array of stable strings`,
      { field }
    );
  }
  // Copy — never sort or mutate caller array in place.
  const source = codes.slice();
  const out = [];
  const seen = new Set();
  for (let i = 0; i < source.length; i += 1) {
    const code = source[i];
    if (typeof code !== "string" || code.trim() === "") {
      throw new OptimizerContractError(
        FAIL,
        `${field}[${i}] must be a non-empty stable string`,
        { field, index: i }
      );
    }
    const trimmed = code.trim();
    if (seen.has(trimmed)) {
      throw new OptimizerContractError(
        FAIL,
        `Duplicate entry in ${field}: ${trimmed}`,
        { field, code: trimmed }
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
 * @returns {Readonly<{
 *   objectiveId: string,
 *   objectiveVersion: string,
 *   direction: string,
 *   evaluatorRef: string,
 *   requiredContextRefs: ReadonlyArray<string>,
 *   normalizationPolicy: string,
 *   metadataCodes: ReadonlyArray<string>,
 * }>}
 */
export function createObjectiveDefinition(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "ObjectiveDefinition",
    FAIL
  );

  const objectiveId = requireStableId(
    ownValue(partial, "objectiveId"),
    "ObjectiveDefinition.objectiveId",
    FAIL
  );
  const objectiveVersion = requireStableId(
    ownValue(partial, "objectiveVersion"),
    "ObjectiveDefinition.objectiveVersion",
    FAIL
  );
  const evaluatorRef = requireStableId(
    ownValue(partial, "evaluatorRef"),
    "ObjectiveDefinition.evaluatorRef",
    FAIL
  );

  const direction = ownValue(partial, "direction");
  if (!isObjectiveSense(direction)) {
    throw new OptimizerContractError(
      FAIL,
      `Invalid ObjectiveDefinition.direction: ${direction}`,
      {
        direction: direction ?? null,
        allowed: [OBJECTIVE_SENSE.MINIMIZE, OBJECTIVE_SENSE.MAXIMIZE],
      }
    );
  }

  const requiredContextRefs = Object.freeze(
    normalizeStableCodeList(
      ownValue(partial, "requiredContextRefs"),
      "ObjectiveDefinition.requiredContextRefs"
    )
  );
  const metadataCodes = Object.freeze(
    normalizeStableCodeList(
      ownValue(partial, "metadataCodes"),
      "ObjectiveDefinition.metadataCodes"
    )
  );

  const normalizationRaw = ownValue(partial, "normalizationPolicy");
  const normalizationPolicy =
    normalizationRaw == null
      ? OBJECTIVE_NORMALIZATION_POLICY.NONE
      : requireStableId(
          normalizationRaw,
          "ObjectiveDefinition.normalizationPolicy",
          FAIL
        );

  if (normalizationPolicy !== OBJECTIVE_NORMALIZATION_POLICY.NONE) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.UNSUPPORTED_NORMALIZATION_POLICY,
      `Unsupported normalizationPolicy: ${normalizationPolicy}`,
      { normalizationPolicy }
    );
  }

  // Owned clone + freeze — never freezes caller input.
  return /** @type {Readonly<object>} */ (
    deepFreezeCanonical(
      {
        objectiveId,
        objectiveVersion,
        direction,
        evaluatorRef,
        requiredContextRefs: [...requiredContextRefs],
        normalizationPolicy,
        metadataCodes: [...metadataCodes],
      },
      "ObjectiveDefinition"
    )
  );
}
