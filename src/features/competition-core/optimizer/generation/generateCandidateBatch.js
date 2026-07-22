/**
 * CORE-10 Phase 1J — deterministic Cartesian Candidate Batch generation.
 *
 * Synchronous, domain-neutral, string-domain-only. No evaluation, ranking,
 * search, randomization, or optimization-budget ownership.
 */

import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { createCandidateBatch } from "../contracts/candidateBatch.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { fingerprintValue } from "../deterministic/fingerprint.js";
import { validateOptimizationRequest } from "../constraints/structuralValidation.js";
import { createDeterministicCandidateGenerationSpec } from "./deterministicCandidateGenerationSpec.js";

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
 * @param {Readonly<object>} request
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
 * Legal generated valueIds are string members of the request domain only.
 * Non-string domain entries are never convertible.
 *
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
 * Fail closed when generation variables and request decision variables mismatch.
 *
 * @param {Readonly<object>} request
 * @param {Readonly<{
 *   variables: ReadonlyArray<Readonly<{
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

  if (spec.variables.length !== requestById.size) {
    throw new OptimizerContractError(
      FAIL,
      "Generation Spec variables must match OptimizationRequest decision variables exactly",
      {
        generationVariableCount: spec.variables.length,
        requestVariableCount: requestById.size,
      }
    );
  }

  for (let i = 0; i < spec.variables.length; i += 1) {
    const variable = spec.variables[i];
    const dv = requestById.get(variable.variableId);
    if (!dv) {
      throw new OptimizerContractError(
        FAIL,
        `Generation Spec variable is not present on OptimizationRequest: ${variable.variableId}`,
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
          `Generation valueId is not a legal string domain member for ${variable.variableId}: ${valueId}`,
          { variableId: variable.variableId, valueId }
        );
      }
    }
  }

  if (requestById.size > 0) {
    const missing = [...requestById.keys()].sort();
    throw new OptimizerContractError(
      FAIL,
      `OptimizationRequest decision variables missing from Generation Spec: ${missing.join(", ")}`,
      { missingVariableIds: missing }
    );
  }
}

/**
 * Safe Cartesian cardinality with early exit against maxGeneratedCandidates.
 *
 * @param {ReadonlyArray<Readonly<{ valueIds: ReadonlyArray<string> }>>} variables
 * @param {number} maxGeneratedCandidates
 * @returns {number}
 */
function calculateCardinality(variables, maxGeneratedCandidates) {
  let product = 1;
  for (let i = 0; i < variables.length; i += 1) {
    const len = variables[i].valueIds.length;
    if (len <= 0 || !Number.isSafeInteger(len)) {
      throw new OptimizerContractError(
        FAIL,
        "Generation domain length must be a positive safe integer",
        { index: i, length: len }
      );
    }
    if (product > Math.floor(Number.MAX_SAFE_INTEGER / len)) {
      throw new OptimizerContractError(
        FAIL,
        "Generation cardinality exceeds safe integer range",
        {
          reason: "GENERATION_LIMIT_EXCEEDED",
          maxGeneratedCandidates,
        }
      );
    }
    product *= len;
    if (product > maxGeneratedCandidates) {
      throw new OptimizerContractError(
        FAIL,
        "Generation cardinality exceeds maxGeneratedCandidates",
        {
          reason: "GENERATION_LIMIT_EXCEEDED",
          cardinality: product,
          maxGeneratedCandidates,
        }
      );
    }
  }
  if (!Number.isSafeInteger(product) || product <= 0) {
    throw new OptimizerContractError(
      FAIL,
      "Generation cardinality must be a positive safe integer",
      {
        reason: "GENERATION_LIMIT_EXCEEDED",
        cardinality: product,
        maxGeneratedCandidates,
      }
    );
  }
  return product;
}

/**
 * @param {ReadonlyArray<Readonly<{
 *   variableId: string,
 *   valueIds: ReadonlyArray<string>,
 * }>>} variables
 * @param {number} cardinality
 * @returns {Array<{
 *   candidateId: string,
 *   assignments: Array<{ variableId: string, valueId: string }>,
 * }>}
 */
function enumerateCartesianCandidates(variables, cardinality) {
  const n = variables.length;
  const lengths = variables.map((v) => v.valueIds.length);
  const indices = new Array(n).fill(0);
  /** @type {Array<{ candidateId: string, assignments: Array<{ variableId: string, valueId: string }> }>} */
  const candidates = [];

  for (let k = 0; k < cardinality; k += 1) {
    /** @type {Array<{ variableId: string, valueId: string }>} */
    const assignments = [];
    for (let i = 0; i < n; i += 1) {
      assignments.push({
        variableId: variables[i].variableId,
        valueId: variables[i].valueIds[indices[i]],
      });
    }

    const candidateId = `cand-${fingerprintValue({ assignments })}`;
    candidates.push({ candidateId, assignments });

    for (let i = n - 1; i >= 0; i -= 1) {
      indices[i] += 1;
      if (indices[i] < lengths[i]) break;
      indices[i] = 0;
    }
  }

  return candidates;
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
 * Generate a frozen Candidate Batch by deterministic Cartesian enumeration.
 *
 * @param {unknown} optimizationRequest
 * @param {unknown} deterministicCandidateGenerationSpec
 * @returns {Readonly<object>}
 */
export function generateCandidateBatch(
  optimizationRequest,
  deterministicCandidateGenerationSpec
) {
  rejectThenableOrPromise(optimizationRequest, "optimizationRequest");
  rejectThenableOrPromise(
    deterministicCandidateGenerationSpec,
    "deterministicCandidateGenerationSpec"
  );

  if (optimizationRequest === undefined || optimizationRequest === null) {
    throw new OptimizerContractError(
      FAIL,
      "optimizationRequest is required",
      { optimizationRequest: optimizationRequest ?? null }
    );
  }

  const request = admitOptimizationRequest(optimizationRequest);
  const spec = createDeterministicCandidateGenerationSpec(
    /** @type {object} */ (deterministicCandidateGenerationSpec)
  );

  assertRequestSpecCompatibility(request, spec);

  const cardinality = calculateCardinality(
    spec.variables,
    spec.maxGeneratedCandidates
  );

  const candidates = enumerateCartesianCandidates(spec.variables, cardinality);

  return createCandidateBatch({
    candidates,
    decisionVariables: cloneDecisionVariables(request),
    objectiveExecutionSpecs: [],
    authorityValues: [],
  });
}
