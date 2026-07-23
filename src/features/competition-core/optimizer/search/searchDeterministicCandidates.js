/**
 * CORE-10 Phase 1L — deterministic bounded structural candidate search (DFS V1).
 *
 * Synchronous only. Emits complete candidates only. No evaluation, ranking,
 * pruning, feasibility checks, or random/host-dependent behavior.
 * maxNodes is owned exclusively by this search path.
 */

import {
  CORE10_DETERMINISTIC_BOUNDED_SEARCH_STRATEGY_DFS_V1,
  CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1,
} from "../constants/versions.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { createCandidateBatch } from "../contracts/candidateBatch.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { deepFreezeCanonical } from "../deterministic/canonicalize.js";
import { fingerprintValue } from "../deterministic/fingerprint.js";
import { validateOptimizationRequest } from "../constraints/structuralValidation.js";
import { createDeterministicBoundedSearchSpec } from "./deterministicBoundedSearchSpec.js";

const FAIL = OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST;

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
 * @param {string} label
 */
function rejectThenableOrPromise(value, label) {
  if (isThenable(value)) {
    throw new OptimizerContractError(
      FAIL,
      `${label} must not be a Promise/thenable`,
      {}
    );
  }
}

/**
 * @param {unknown} request
 * @returns {Readonly<object>}
 */
function admitOptimizationRequest(request) {
  const validated = validateOptimizationRequest(request);
  if (!validated.ok) {
    const issue = validated.issues[0] || {
      code: FAIL,
      message: "Invalid OptimizationRequest",
      details: {},
    };
    throw new OptimizerContractError(
      issue.code,
      issue.message,
      issue.details || {}
    );
  }
  return validated.request;
}

/**
 * @param {readonly unknown[]} domain
 * @param {string} valueId
 * @returns {boolean}
 */
function domainContainsStringValueId(domain, valueId) {
  for (let i = 0; i < domain.length; i += 1) {
    const entry = domain[i];
    if (typeof entry === "string" && entry === valueId) {
      return true;
    }
  }
  return false;
}

/**
 * Fail closed when search variables and request decision variables mismatch.
 *
 * @param {Readonly<object>} request
 * @param {Readonly<{
 *   decisionVariables: ReadonlyArray<Readonly<{
 *     variableId: string,
 *     valueIds: ReadonlyArray<string>,
 *   }>>,
 * }>} spec
 */
function assertRequestSpecCompatibility(request, spec) {
  const decisionVariables = request.decisionVariables;
  if (!Array.isArray(decisionVariables) || decisionVariables.length === 0) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN,
      "OptimizationRequest.decisionVariables must be a non-empty array",
      {}
    );
  }

  /** @type {Map<string, Readonly<object>>} */
  const requestById = new Map();
  for (let i = 0; i < decisionVariables.length; i += 1) {
    const dv = decisionVariables[i];
    if (!dv || typeof dv !== "object") {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN,
        `decisionVariables[${i}] must be an object`,
        { index: i }
      );
    }
    const variableId = /** @type {{ variableId?: unknown }} */ (dv).variableId;
    if (typeof variableId !== "string" || variableId.trim() === "") {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN,
        `decisionVariables[${i}].variableId is invalid`,
        { index: i }
      );
    }
    if (requestById.has(variableId)) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN,
        `Duplicate decision variableId: ${variableId}`,
        { variableId }
      );
    }
    requestById.set(variableId, /** @type {Readonly<object>} */ (dv));
  }

  if (spec.decisionVariables.length !== requestById.size) {
    throw new OptimizerContractError(
      FAIL,
      "Search Spec decisionVariables must match OptimizationRequest decision variables exactly",
      {
        searchVariableCount: spec.decisionVariables.length,
        requestVariableCount: requestById.size,
      }
    );
  }

  for (let i = 0; i < spec.decisionVariables.length; i += 1) {
    const variable = spec.decisionVariables[i];
    const dv = requestById.get(variable.variableId);
    if (!dv) {
      throw new OptimizerContractError(
        FAIL,
        `Search Spec variable is not present on OptimizationRequest: ${variable.variableId}`,
        { variableId: variable.variableId }
      );
    }
    requestById.delete(variable.variableId);

    const domain = /** @type {{ domain?: unknown }} */ (dv).domain;
    if (!Array.isArray(domain)) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN,
        `decisionVariables domain missing for ${variable.variableId}`,
        { variableId: variable.variableId }
      );
    }

    for (let j = 0; j < variable.valueIds.length; j += 1) {
      const valueId = variable.valueIds[j];
      if (!domainContainsStringValueId(domain, valueId)) {
        throw new OptimizerContractError(
          FAIL,
          `Search valueId is not a legal string domain member for ${variable.variableId}: ${valueId}`,
          { variableId: variable.variableId, valueId }
        );
      }
    }
  }

  if (requestById.size > 0) {
    const missing = [...requestById.keys()].sort();
    throw new OptimizerContractError(
      FAIL,
      `OptimizationRequest decision variables missing from Search Spec: ${missing.join(", ")}`,
      { missingVariableIds: missing }
    );
  }
}

/**
 * @param {Readonly<object>} request
 * @returns {unknown[]}
 */
function cloneDecisionVariables(request) {
  return request.decisionVariables.map((dv) => {
    if (!isPlainObject(dv)) return dv;
    const domainRaw = /** @type {{ domain?: unknown }} */ (dv).domain;
    return {
      variableId: /** @type {{ variableId?: unknown }} */ (dv).variableId,
      domain: Array.isArray(domainRaw) ? domainRaw.slice() : domainRaw,
      required: /** @type {{ required?: unknown }} */ (dv).required,
    };
  });
}

/**
 * Deterministic DFS V1 over the canonical assignment tree.
 *
 * @param {ReadonlyArray<Readonly<{
 *   variableId: string,
 *   valueIds: ReadonlyArray<string>,
 * }>>} variables
 * @param {number} maxNodes
 * @param {number} maxEmittedCandidates
 * @returns {{
 *   candidates: Array<{ candidateId: string, assignments: Array<{ variableId: string, valueId: string }> }>,
 *   nodesVisited: number,
 *   nodeBudgetExhausted: boolean,
 *   emittedCandidateBudgetExhausted: boolean,
 * }}
 */
function walkDeterministicDfs(variables, maxNodes, maxEmittedCandidates) {
  const n = variables.length;
  /** @type {Array<{ variableId: string, valueId: string }>} */
  const path = [];
  /** @type {Array<{ candidateId: string, assignments: Array<{ variableId: string, valueId: string }> }>} */
  const candidates = [];
  let nodesVisited = 0;
  let nodeBudgetExhausted = false;
  let emittedCandidateBudgetExhausted = false;

  /**
   * Traversal outcomes:
   * - OK: continue
   * - STOP: hard stop (node budget exhausted, or emit cap with remaining work)
   * - EMIT_CAP: emit cap reached; exhausted only if an ancestor still has
   *   unexplored candidate-bearing siblings (exact-final emit is not exhaustion)
   *
   * @returns {"OK" | "STOP" | "EMIT_CAP"}
   */
  function dfs() {
    nodesVisited += 1;

    if (path.length === n) {
      const assignments = path.map((entry) => ({
        variableId: entry.variableId,
        valueId: entry.valueId,
      }));
      const candidateId = `cand-${fingerprintValue({ assignments })}`;
      candidates.push({ candidateId, assignments });
      if (candidates.length >= maxEmittedCandidates) {
        return "EMIT_CAP";
      }
      return "OK";
    }

    const variable = variables[path.length];
    const valueIds = variable.valueIds;
    for (let i = 0; i < valueIds.length; i += 1) {
      if (nodesVisited >= maxNodes) {
        nodeBudgetExhausted = true;
        return "STOP";
      }
      path.push({
        variableId: variable.variableId,
        valueId: valueIds[i],
      });
      const result = dfs();
      path.pop();
      if (result === "STOP") {
        return "STOP";
      }
      if (result === "EMIT_CAP") {
        // Cap reached on a complete candidate. Remaining siblings at this
        // level imply at least one unexplored complete candidate remains.
        if (i + 1 < valueIds.length) {
          emittedCandidateBudgetExhausted = true;
          return "STOP";
        }
        // No remaining siblings here - propagate so ancestors can decide.
        return "EMIT_CAP";
      }
    }
    return "OK";
  }

  dfs();

  return {
    candidates,
    nodesVisited,
    nodeBudgetExhausted,
    emittedCandidateBudgetExhausted,
  };
}

/**
 * Search complete candidates via deterministic bounded DFS.
 *
 * @param {unknown} optimizationRequest
 * @param {unknown} searchSpec
 * @returns {Readonly<{
 *   candidateBatch: Readonly<object>,
 *   nodesVisited: number,
 *   nodeBudgetExhausted: boolean,
 *   emittedCandidateBudgetExhausted: boolean,
 *   searchComplete: boolean,
 *   emittedCount: number,
 *   searchVersion: string,
 *   strategy: string,
 * }>}
 */
export function searchDeterministicCandidates(
  optimizationRequest,
  searchSpec
) {
  rejectThenableOrPromise(optimizationRequest, "optimizationRequest");
  rejectThenableOrPromise(searchSpec, "searchSpec");

  if (optimizationRequest === undefined || optimizationRequest === null) {
    throw new OptimizerContractError(
      FAIL,
      "optimizationRequest is required",
      { optimizationRequest: optimizationRequest ?? null }
    );
  }

  const request = admitOptimizationRequest(optimizationRequest);
  const spec = createDeterministicBoundedSearchSpec(
    /** @type {object} */ (searchSpec)
  );

  if (spec.strategy !== CORE10_DETERMINISTIC_BOUNDED_SEARCH_STRATEGY_DFS_V1) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.UNSUPPORTED_STRATEGY,
      `searchDeterministicCandidates Strategy V1 requires ${CORE10_DETERMINISTIC_BOUNDED_SEARCH_STRATEGY_DFS_V1}`,
      { strategy: spec.strategy }
    );
  }

  const maxNodes = request.deterministicBudget.maxNodes;
  if (maxNodes == null) {
    throw new OptimizerContractError(
      FAIL,
      "deterministicBudget.maxNodes is required for deterministic bounded search and must not be null",
      { maxNodes: null }
    );
  }
  if (typeof maxNodes !== "number" || !Number.isSafeInteger(maxNodes) || maxNodes < 0) {
    throw new OptimizerContractError(
      FAIL,
      "deterministicBudget.maxNodes must be a non-negative safe integer",
      { maxNodes }
    );
  }

  assertRequestSpecCompatibility(request, spec);

  /** @type {{
   *   candidates: Array<{ candidateId: string, assignments: Array<{ variableId: string, valueId: string }> }>,
   *   nodesVisited: number,
   *   nodeBudgetExhausted: boolean,
   *   emittedCandidateBudgetExhausted: boolean,
   * }} */
  let walk;
  if (maxNodes === 0) {
    // Zero is a real limit: no node may be visited (root would be node 1).
    walk = {
      candidates: [],
      nodesVisited: 0,
      nodeBudgetExhausted: true,
      emittedCandidateBudgetExhausted: false,
    };
  } else {
    walk = walkDeterministicDfs(
      spec.decisionVariables,
      maxNodes,
      spec.maxEmittedCandidates
    );
  }

  const searchComplete =
    !walk.nodeBudgetExhausted && !walk.emittedCandidateBudgetExhausted;

  const candidateBatch = createCandidateBatch({
    candidates: walk.candidates,
    decisionVariables: cloneDecisionVariables(request),
    objectiveExecutionSpecs: [],
    authorityValues: [],
  });

  return /** @type {Readonly<object>} */ (
    deepFreezeCanonical(
      {
        candidateBatch,
        nodesVisited: walk.nodesVisited,
        nodeBudgetExhausted: walk.nodeBudgetExhausted,
        emittedCandidateBudgetExhausted: walk.emittedCandidateBudgetExhausted,
        searchComplete,
        emittedCount: walk.candidates.length,
        searchVersion: CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1,
        strategy: spec.strategy,
      },
      "DeterministicBoundedSearchResult"
    )
  );
}
