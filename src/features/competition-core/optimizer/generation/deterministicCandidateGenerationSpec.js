/**
 * CORE-10 Phase 1J — DeterministicCandidateGenerationSpec contract.
 *
 * Bounded structural generation specification only.
 * String value domains; no evaluation, ranking, search, or budget ownership.
 */

import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { compareStableString } from "../deterministic/compare.js";
import {
  deepFreezeCanonical,
  isPlainObject,
} from "../deterministic/canonicalize.js";
import {
  rejectUnknownFields,
  requirePositiveInt,
  requireStableId,
} from "../contracts/shared.js";

const FAIL = OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST;

const SPEC_ALLOWED = Object.freeze(["variables", "maxGeneratedCandidates"]);

const VARIABLE_ALLOWED = Object.freeze(["variableId", "valueIds"]);

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
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requirePositiveSafeInt(value, field) {
  const n = requirePositiveInt(value, field, FAIL);
  if (!Number.isSafeInteger(n)) {
    throw new OptimizerContractError(
      FAIL,
      `${field} must be a positive safe integer`,
      { field, value: n }
    );
  }
  return n;
}

/**
 * @param {unknown} raw
 * @param {string} path
 * @returns {{ variableId: string, valueIds: string[] }}
 */
function createGenerationVariable(raw, path) {
  if (!isPlainObject(raw)) {
    throw new OptimizerContractError(
      FAIL,
      `${path} must be a plain object`,
      { path }
    );
  }
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (raw),
    VARIABLE_ALLOWED,
    path,
    FAIL
  );

  const variableId = requireStableId(
    ownValue(/** @type {object} */ (raw), "variableId"),
    `${path}.variableId`,
    FAIL
  );

  const valueIdsRaw = ownValue(/** @type {object} */ (raw), "valueIds");
  if (!Array.isArray(valueIdsRaw) || valueIdsRaw.length === 0) {
    throw new OptimizerContractError(
      FAIL,
      `${path}.valueIds must be a non-empty array`,
      { path, variableId }
    );
  }

  const valueIdsSource = valueIdsRaw.slice();
  /** @type {string[]} */
  const valueIds = [];
  const seenValues = new Set();
  for (let i = 0; i < valueIdsSource.length; i += 1) {
    const entry = valueIdsSource[i];
    if (typeof entry !== "string") {
      throw new OptimizerContractError(
        FAIL,
        `${path}.valueIds[${i}] must be a string`,
        { path, variableId, index: i, value: entry ?? null }
      );
    }
    const valueId = requireStableId(
      entry,
      `${path}.valueIds[${i}]`,
      FAIL
    );
    if (seenValues.has(valueId)) {
      throw new OptimizerContractError(
        FAIL,
        `${path}.valueIds contains duplicate valueId: ${valueId}`,
        { path, variableId, valueId }
      );
    }
    seenValues.add(valueId);
    valueIds.push(valueId);
  }

  valueIds.sort(compareStableString);

  return { variableId, valueIds };
}

/**
 * Create an immutable DeterministicCandidateGenerationSpec.
 *
 * @param {object} [partial]
 * @returns {Readonly<{
 *   variables: ReadonlyArray<Readonly<{
 *     variableId: string,
 *     valueIds: ReadonlyArray<string>,
 *   }>>,
 *   maxGeneratedCandidates: number,
 * }>}
 */
export function createDeterministicCandidateGenerationSpec(partial = {}) {
  if (isThenable(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "DeterministicCandidateGenerationSpec must not be a Promise/thenable",
      {}
    );
  }
  if (!isPlainObject(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "DeterministicCandidateGenerationSpec must be a plain object",
      {}
    );
  }

  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    SPEC_ALLOWED,
    "DeterministicCandidateGenerationSpec",
    FAIL
  );

  const variablesRaw = ownValue(partial, "variables");
  if (!Array.isArray(variablesRaw) || variablesRaw.length === 0) {
    throw new OptimizerContractError(
      FAIL,
      "DeterministicCandidateGenerationSpec.variables must be a non-empty array",
      {}
    );
  }

  const variablesSource = variablesRaw.slice();
  /** @type {Array<{ variableId: string, valueIds: string[] }>} */
  const variables = [];
  const seenVariableIds = new Set();
  for (let i = 0; i < variablesSource.length; i += 1) {
    const created = createGenerationVariable(
      variablesSource[i],
      `DeterministicCandidateGenerationSpec.variables[${i}]`
    );
    if (seenVariableIds.has(created.variableId)) {
      throw new OptimizerContractError(
        FAIL,
        `Duplicate generation variableId: ${created.variableId}`,
        { variableId: created.variableId }
      );
    }
    seenVariableIds.add(created.variableId);
    variables.push(created);
  }

  variables.sort((a, b) => compareStableString(a.variableId, b.variableId));

  const maxGeneratedCandidates = requirePositiveSafeInt(
    ownValue(partial, "maxGeneratedCandidates"),
    "DeterministicCandidateGenerationSpec.maxGeneratedCandidates"
  );

  return /** @type {Readonly<object>} */ (
    deepFreezeCanonical(
      {
        variables,
        maxGeneratedCandidates,
      },
      "DeterministicCandidateGenerationSpec"
    )
  );
}
