import { createEngineValidationResult } from "../contracts/engineContracts.js";
import { isConstraintsV2Enabled } from "../config/featureFlags.js";
import { detectConstraintConflicts, validateRuleSetConflicts } from "./detectConflicts.js";
import { evaluateHardRules } from "./evaluateHardRules.js";
import { normalizeRuleSet } from "./normalizeRule.js";
import { scoreSoftRules } from "./scoreSoftRules.js";
import { RULE_ENGINE_VERSION, RULE_ERROR_CODE } from "./ruleConstants.js";

/**
 * @typedef {import('./normalizeRule.js').RuleSet} RuleSet
 * @typedef {import('./evaluateHardRules.js').RuleEvaluationContext} RuleEvaluationContext
 * @typedef {import('../types/index.js').EngineValidationResult} EngineValidationResult
 */

/**
 * @typedef {Object} CanonicalRuleEvaluationResult
 * @property {boolean} enabled
 * @property {boolean} feasible
 * @property {EngineValidationResult} validation
 * @property {import('../types/index.js').EngineExplanation[]} hardViolations
 * @property {number} softScore
 * @property {import('../types/index.js').EngineScoreBreakdown} [softBreakdown]
 * @property {import('../types/index.js').EngineExplanation[]} softNotes
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
  const enabled = isConstraintsV2Enabled(options.envSource);

  if (!enabled) {
    return {
      enabled: false,
      feasible: true,
      validation: createEngineValidationResult({ ok: true }),
      hardViolations: [],
      softScore: 0,
      softNotes: [],
      engineVersion: RULE_ENGINE_VERSION,
      ruleSetId: normalized.id,
      ruleSetVersion: normalized.version,
    };
  }

  const conflictCheck = validateRuleSetConflicts(normalized);
  if (!options.skipConflictCheck && !conflictCheck.ok) {
    return {
      enabled: true,
      feasible: false,
      validation: createEngineValidationResult({
        ok: false,
        conflicts: conflictCheck.conflicts,
        errors: conflictCheck.conflicts.map((item) => item.message),
      }),
      hardViolations: [],
      softScore: 0,
      softNotes: [],
      engineVersion: RULE_ENGINE_VERSION,
      ruleSetId: normalized.id,
      ruleSetVersion: normalized.version,
    };
  }

  const hard = evaluateHardRules(normalized.constraints, context);
  const soft = scoreSoftRules(normalized.constraints, context);

  return {
    enabled: true,
    feasible: hard.feasible,
    validation: createEngineValidationResult({
      ok: hard.feasible,
      errors: hard.violations.map((item) => item.message),
      conflicts: conflictCheck.conflicts,
    }),
    hardViolations: hard.violations,
    softScore: soft.total,
    softBreakdown: soft.breakdown,
    softNotes: soft.notes,
    engineVersion: RULE_ENGINE_VERSION,
    ruleSetId: normalized.id,
    ruleSetVersion: normalized.version,
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

  const conflicts = detectConstraintConflicts(normalized);
  return {
    ok: conflicts.length === 0,
    conflicts,
    engineVersion: RULE_ENGINE_VERSION,
  };
}

export { RULE_ERROR_CODE };
