/**
 * CORE-10 Phase 1L — DeterministicBoundedSearchSpec contract.
 *
 * Reuses Phase 1J variable/domain model shape without modifying Phase 1J.
 * String value domains; no evaluation, ranking, or budget ownership of maxNodes.
 */

import {
  CORE10_DETERMINISTIC_BOUNDED_SEARCH_STRATEGY_DFS_V1,
  CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1,
} from "../constants/versions.js";
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

const SPEC_ALLOWED = Object.freeze([
  "searchSpecVersion",
  "decisionVariables",
  "maxEmittedCandidates",
  "strategy",
]);

const VARIABLE_ALLOWED = Object.freeze(["variableId", "valueIds"]);

const SUPPORTED_STRATEGIES = Object.freeze([
  CORE10_DETERMINISTIC_BOUNDED_SEARCH_STRATEGY_DFS_V1,
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
 * @param {object} obj
 * @param {string} path
 */
function rejectAccessors(obj, path) {
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const desc = Object.getOwnPropertyDescriptor(obj, key);
    if (
      desc &&
      (typeof desc.get === "function" || typeof desc.set === "function")
    ) {
      throw new OptimizerContractError(
        FAIL,
        `${path}.${key} must not be an accessor`,
        { path, field: key }
      );
    }
  }
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
function createSearchVariable(raw, path) {
  if (!isPlainObject(raw)) {
    throw new OptimizerContractError(
      FAIL,
      `${path} must be a plain object`,
      { path }
    );
  }
  rejectAccessors(/** @type {object} */ (raw), path);
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
 * Create an immutable DeterministicBoundedSearchSpec.
 *
 * @param {object} [partial]
 * @returns {Readonly<{
 *   searchSpecVersion: string,
 *   decisionVariables: ReadonlyArray<Readonly<{
 *     variableId: string,
 *     valueIds: ReadonlyArray<string>,
 *   }>>,
 *   maxEmittedCandidates: number,
 *   strategy: string,
 * }>}
 */
export function createDeterministicBoundedSearchSpec(partial = {}) {
  if (isThenable(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "DeterministicBoundedSearchSpec must not be a Promise/thenable",
      {}
    );
  }
  if (!isPlainObject(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "DeterministicBoundedSearchSpec must be a plain object",
      {}
    );
  }

  rejectAccessors(
    /** @type {object} */ (partial),
    "DeterministicBoundedSearchSpec"
  );
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    SPEC_ALLOWED,
    "DeterministicBoundedSearchSpec",
    FAIL
  );

  const searchSpecVersion = requireStableId(
    ownValue(partial, "searchSpecVersion") ??
      CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1,
    "DeterministicBoundedSearchSpec.searchSpecVersion",
    FAIL
  );
  if (searchSpecVersion !== CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1) {
    throw new OptimizerContractError(
      FAIL,
      `Unsupported DeterministicBoundedSearchSpec version: ${searchSpecVersion}`,
      {
        searchSpecVersion,
        supported: CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1,
      }
    );
  }

  const strategy = requireStableId(
    ownValue(partial, "strategy") ??
      CORE10_DETERMINISTIC_BOUNDED_SEARCH_STRATEGY_DFS_V1,
    "DeterministicBoundedSearchSpec.strategy",
    FAIL
  );
  if (!SUPPORTED_STRATEGIES.includes(strategy)) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.UNSUPPORTED_STRATEGY,
      `Unsupported deterministic bounded-search strategy: ${strategy}`,
      {
        strategy,
        supported: [...SUPPORTED_STRATEGIES],
      }
    );
  }

  const decisionVariablesRaw = ownValue(partial, "decisionVariables");
  if (!Array.isArray(decisionVariablesRaw) || decisionVariablesRaw.length === 0) {
    throw new OptimizerContractError(
      FAIL,
      "DeterministicBoundedSearchSpec.decisionVariables must be a non-empty array",
      {}
    );
  }

  const variablesSource = decisionVariablesRaw.slice();
  /** @type {Array<{ variableId: string, valueIds: string[] }>} */
  const decisionVariables = [];
  const seenVariableIds = new Set();
  for (let i = 0; i < variablesSource.length; i += 1) {
    const created = createSearchVariable(
      variablesSource[i],
      `DeterministicBoundedSearchSpec.decisionVariables[${i}]`
    );
    if (seenVariableIds.has(created.variableId)) {
      throw new OptimizerContractError(
        FAIL,
        `Duplicate search variableId: ${created.variableId}`,
        { variableId: created.variableId }
      );
    }
    seenVariableIds.add(created.variableId);
    decisionVariables.push(created);
  }

  decisionVariables.sort((a, b) =>
    compareStableString(a.variableId, b.variableId)
  );

  const maxEmittedCandidates = requirePositiveSafeInt(
    ownValue(partial, "maxEmittedCandidates"),
    "DeterministicBoundedSearchSpec.maxEmittedCandidates"
  );

  return /** @type {Readonly<object>} */ (
    deepFreezeCanonical(
      {
        searchSpecVersion,
        decisionVariables,
        maxEmittedCandidates,
        strategy,
      },
      "DeterministicBoundedSearchSpec"
    )
  );
}
