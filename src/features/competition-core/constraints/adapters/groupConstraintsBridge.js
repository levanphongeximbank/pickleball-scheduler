import { evaluateCanonicalRulesRuntime } from "./rulesRuntimeOrchestrator.js";
import {
  mapGroupConstraintsToContext,
  mapGroupConstraintsToRuleSet,
} from "./legacyRuleMappers.js";
import { toPairingConstraintEvaluation } from "./adaptLegacyResult.js";
import { createDecisionTrace } from "./decisionTrace.js";

/**
 * Group constraint bridge — pre/post draw validation only; does not rewrite draw algorithm.
 *
 * @param {Array<Record<string, unknown>>} groups
 * @param {Array<Record<string, unknown>>} constraints
 * @param {Object} [options]
 */
export function evaluateLegacyGroupConstraints(groups = [], constraints = [], options = {}) {
  const context = mapGroupConstraintsToContext(groups, options.players || []);
  const ruleSet = mapGroupConstraintsToRuleSet(constraints, options.ruleSetMeta);
  const candidate = {
    groups: context.groups,
  };

  return evaluateCanonicalRulesRuntime({
    consumer: "group_constraints",
    candidate,
    context,
    ruleSet,
    envSource: options.envSource,
    legacyPayload: { groups, constraints },
    legacyEvaluate: options.legacyEvaluate,
    adapt: toPairingConstraintEvaluation,
    trace: options.trace || createDecisionTrace(),
  });
}

/**
 * Post-draw group validation for audit/explanation.
 *
 * @param {Array<Record<string, unknown>>} groups
 * @param {Array<Record<string, unknown>>} constraints
 * @param {Object} [options]
 */
export function validateGroupConstraintsPostDraw(groups = [], constraints = [], options = {}) {
  const bridge = evaluateLegacyGroupConstraints(groups, constraints, options);
  return {
    ...bridge,
    validationPhase: "post_draw",
  };
}

/**
 * Pre-draw candidate group validation.
 *
 * @param {Array<Record<string, unknown>>} candidateGroups
 * @param {Array<Record<string, unknown>>} constraints
 * @param {Object} [options]
 */
export function validateGroupConstraintsPreDraw(candidateGroups = [], constraints = [], options = {}) {
  const bridge = evaluateLegacyGroupConstraints(candidateGroups, constraints, {
    ...options,
    ruleSetMeta: { ...(options.ruleSetMeta || {}), id: "group-constraints-pre-draw" },
  });
  return {
    ...bridge,
    validationPhase: "pre_draw",
  };
}
