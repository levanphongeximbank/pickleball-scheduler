/**
 * CORE-10 — OptimizationRequest contract.
 */

import { CORE10_SCHEMA_VERSION } from "../constants/versions.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { resolveSolverStrategy } from "../enums/solverStrategy.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { normalizeSeed } from "../deterministic/seededRandom.js";
import { createDecisionVariable } from "./decisionVariable.js";
import { createOptimizationContext } from "./optimizationContext.js";
import { createOptimizationOperation } from "./optimizationOperation.js";
import { createOptimizationPolicy } from "./optimizationPolicy.js";
import {
  rejectUnknownFields,
  requireNonNegativeInt,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "requestId",
  "tenantId",
  "competitionId",
  "operation",
  "policy",
  "context",
  "decisionVariables",
  "seed",
  "deterministicBudget",
  "strategy",
]);

const BUDGET_ALLOWED = Object.freeze([
  "maxNodes",
  "maxCandidates",
  "maxEvaluations",
]);

/**
 * @param {object} budget
 * @returns {Readonly<{ maxNodes: number|null, maxCandidates: number|null, maxEvaluations: number|null }>}
 */
export function createDeterministicBudget(budget = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (budget),
    BUDGET_ALLOWED,
    "deterministicBudget",
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );

  /**
   * @param {unknown} value
   * @param {string} field
   * @returns {number|null}
   */
  function optionalBudgetInt(value, field) {
    if (value == null) return null;
    return requireNonNegativeInt(
      value,
      field,
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    );
  }

  const out = Object.freeze({
    maxNodes: optionalBudgetInt(budget.maxNodes, "deterministicBudget.maxNodes"),
    maxCandidates: optionalBudgetInt(
      budget.maxCandidates,
      "deterministicBudget.maxCandidates"
    ),
    maxEvaluations: optionalBudgetInt(
      budget.maxEvaluations,
      "deterministicBudget.maxEvaluations"
    ),
  });

  if (
    out.maxNodes == null &&
    out.maxCandidates == null &&
    out.maxEvaluations == null
  ) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      "deterministicBudget requires at least one of maxNodes, maxCandidates, maxEvaluations",
      {}
    );
  }

  return out;
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createOptimizationRequest(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "OptimizationRequest",
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );

  const schemaVersion = requireStableId(
    partial.schemaVersion ?? CORE10_SCHEMA_VERSION,
    "OptimizationRequest.schemaVersion",
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  if (schemaVersion !== CORE10_SCHEMA_VERSION) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      `Unsupported schemaVersion: ${schemaVersion}`,
      { schemaVersion, expected: CORE10_SCHEMA_VERSION }
    );
  }

  const tenantId = requireStableId(
    partial.tenantId,
    "OptimizationRequest.tenantId",
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  const competitionId = requireStableId(
    partial.competitionId,
    "OptimizationRequest.competitionId",
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );

  const operation =
    partial.operation && typeof partial.operation === "object"
      ? createOptimizationOperation(partial.operation)
      : createOptimizationOperation({ operationId: partial.operation });

  if (!partial.policy || typeof partial.policy !== "object") {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_POLICY,
      "OptimizationRequest.policy is required",
      {}
    );
  }
  const policy = createOptimizationPolicy(partial.policy);

  if (!partial.context || typeof partial.context !== "object") {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_CONTEXT,
      "OptimizationRequest.context is required",
      {}
    );
  }
  const context = createOptimizationContext(partial.context);

  if (context.tenantId !== tenantId) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.TENANT_SCOPE_MISMATCH,
      "context.tenantId must equal request.tenantId",
      { requestTenantId: tenantId, contextTenantId: context.tenantId }
    );
  }
  if (context.competitionId !== competitionId) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.COMPETITION_SCOPE_MISMATCH,
      "context.competitionId must equal request.competitionId",
      {
        requestCompetitionId: competitionId,
        contextCompetitionId: context.competitionId,
      }
    );
  }

  if (
    !Array.isArray(partial.decisionVariables) ||
    partial.decisionVariables.length === 0
  ) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN,
      "decisionVariables must be a non-empty array",
      {}
    );
  }

  const seenVars = new Set();
  const decisionVariables = partial.decisionVariables.map((dv, i) => {
    if (!dv || typeof dv !== "object") {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN,
        `decisionVariables[${i}] must be an object`,
        { index: i }
      );
    }
    const created = createDecisionVariable(dv);
    if (seenVars.has(created.variableId)) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN,
        `Duplicate decision variableId: ${created.variableId}`,
        { variableId: created.variableId }
      );
    }
    seenVars.add(created.variableId);
    return created;
  });

  const strategyResolved = resolveSolverStrategy(partial.strategy);
  if (!strategyResolved.ok) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.UNSUPPORTED_STRATEGY,
      `Unsupported or missing strategy: ${partial.strategy}`,
      { strategy: partial.strategy ?? null, reason: strategyResolved.reason }
    );
  }

  if (!partial.deterministicBudget || typeof partial.deterministicBudget !== "object") {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      "deterministicBudget is required",
      {}
    );
  }

  const seed = normalizeSeed(partial.seed);

  return Object.freeze({
    schemaVersion,
    requestId: requireStableId(
      partial.requestId,
      "OptimizationRequest.requestId",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    tenantId,
    competitionId,
    operation,
    policy,
    context,
    decisionVariables: Object.freeze(decisionVariables),
    seed,
    deterministicBudget: createDeterministicBudget(partial.deterministicBudget),
    strategy: strategyResolved.strategy,
  });
}
