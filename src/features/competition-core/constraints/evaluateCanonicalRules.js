import { isConstraintsV2Enabled } from "../config/featureFlags.js";
import { detectConstraintConflicts } from "./detectConflicts.js";
import { normalizeRuleSet } from "./normalizeRule.js";
import { RULE_ENGINE_VERSION, RULE_ERROR_CODE } from "./ruleConstants.js";
import { evaluateCandidate } from "./evaluateCandidate.js";
import { expandApplicableRules } from "./expandApplicableRules.js";
import { resolveContext } from "./resolveContext.js";

/**
 * @typedef {import('./normalizeRule.js').RuleSet} RuleSet
 * @typedef {import('./evaluateHardRules.js').RuleEvaluationContext} RuleEvaluationContext
 * @typedef {import('../types/index.js').EngineValidationResult} EngineValidationResult
 * @typedef {import('../types/index.js').ConstraintEvaluationResult} ConstraintEvaluationResult
 */

/**
 * @typedef {Object} CanonicalRuleEvaluationResult
 * @property {boolean} enabled
 * @property {boolean} feasible
 * @property {EngineValidationResult} validation
 * @property {import('../types/index.js').ConstraintExplanation[]} hardViolations
 * @property {number} softScore
 * @property {import('../types/index.js').EngineScoreBreakdown} [softBreakdown]
 * @property {import('../types/index.js').ConstraintExplanation[]} softNotes
 * @property {import('../types/index.js').ConstraintExplanation[]} explanations
 * @property {string} engineVersion
 * @property {string} ruleSetId
 * @property {string} ruleSetVersion
 */

/**
 * @param {RuleSet|Partial<RuleSet>} ruleSet
 * @param {RuleEvaluationContext} context
 * @param {Object} [options]
 * @param {Record<string, unknown>} [options.envSource]
 * @param {boolean} [options.skipConflictCheck]
 * @returns {CanonicalRuleEvaluationResult}
 */
export function evaluateCanonicalRules(ruleSet, context, options = {}) {
  const normalized = normalizeRuleSet(ruleSet);
  const candidate = {
    teams: context.teams,
    groups: context.groups,
    matchOption: context.matchOption,
  };

  const result = evaluateCandidate(candidate, normalized, resolveContext(context), options);

  return {
    enabled: result.enabled,
    feasible: result.feasible,
    validation: result.validation,
    hardViolations: result.hardViolations,
    softScore: result.softScore,
    softBreakdown: result.softBreakdown,
    softNotes: result.softNotes,
    explanations: result.explanations,
    engineVersion: result.engineVersion,
    ruleSetId: result.ruleSetId,
    ruleSetVersion: result.ruleSetVersion,
  };
}

/**
 * Pre-flight only — detect conflicts without evaluating a candidate.
 *
 * @param {RuleSet|Partial<RuleSet>} ruleSet
 * @param {Object} [options]
 * @returns {{ ok: boolean, conflicts: import('../types/index.js').ConstraintConflict[], engineVersion: string }}
 */
export function preflightRuleSet(ruleSet, options = {}) {
  const normalized = normalizeRuleSet(ruleSet);
  if (!isConstraintsV2Enabled(options.envSource)) {
    return { ok: true, conflicts: [], engineVersion: RULE_ENGINE_VERSION };
  }

  const context = resolveContext(options.context || {});
  const applicable = expandApplicableRules(normalized.constraints, context);
  const conflicts = detectConstraintConflicts(applicable, context);
  return {
    ok: conflicts.length === 0,
    conflicts,
    engineVersion: RULE_ENGINE_VERSION,
  };
}

export { RULE_ERROR_CODE };
