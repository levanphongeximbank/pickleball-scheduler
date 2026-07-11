import { isConstraintsV2Enabled } from "../config/featureFlags.js";
import { detectConstraintConflicts } from "./detectConflicts.js";
import { expandApplicableRules } from "./expandApplicableRules.js";
import { normalizeInput } from "./normalizeInput.js";
import { resolveContext } from "./resolveContext.js";
import { validateRuleSetLifecycle } from "./selectRuleSetVersion.js";
import { validateEligibility } from "./validateHardConstraints.js";
import { validateHardConstraints } from "./validateHardConstraints.js";
import { scoreSoftConstraints } from "./scoreSoftConstraints.js";
import { aggregateResult } from "./aggregateResult.js";
import { RULE_ENGINE_VERSION } from "./ruleConstants.js";

/**
 * @typedef {import('../types/index.js').RuleSet} RuleSet
 * @typedef {import('../types/index.js').ConstraintContext} ConstraintContext
 * @typedef {import('../types/index.js').CandidateAssignment} CandidateAssignment
 * @typedef {import('../types/index.js').ConstraintEvaluationResult} ConstraintEvaluationResult
 */

/**
 * Full CC-03A execution pipeline:
 * normalizeInput → resolveContext → expandApplicableRules → detectConstraintConflicts
 * → validateEligibility → validateHardConstraints → scoreSoftConstraints
 * → aggregateResult → buildExplanation
 *
 * @param {CandidateAssignment} candidate
 * @param {RuleSet|Partial<RuleSet>|import('../types/index.js').ConstraintDefinition[]} constraintsOrRuleSet
 * @param {Partial<ConstraintContext>} [context]
 * @param {Object} [options]
 * @returns {ConstraintEvaluationResult}
 */
export function evaluateCandidate(candidate, constraintsOrRuleSet, context = {}, options = {}) {
  const enabled = isConstraintsV2Enabled(options.envSource);
  const ruleSet = Array.isArray(constraintsOrRuleSet)
    ? { constraints: constraintsOrRuleSet }
    : constraintsOrRuleSet;

  const normalized = normalizeInput({
    ruleSet,
    context,
    candidate,
    envSource: options.envSource,
  });

  if (!enabled) {
    return aggregateResult({
      enabled: false,
      eligible: true,
      feasible: true,
      softScore: 0,
      ruleSetId: normalized.ruleSet.id,
      ruleSetVersion: normalized.ruleSet.version,
      engineVersion: RULE_ENGINE_VERSION,
    });
  }

  const lifecycle = validateRuleSetLifecycle(normalized.ruleSet, normalized.context);
  if (!lifecycle.ok) {
    return aggregateResult({
      enabled: true,
      eligible: false,
      feasible: false,
      hardViolations: [
        {
          reasonCode: lifecycle.code || "rule_set_not_effective",
          title: "Rule set lifecycle",
          message: lifecycle.message || "Rule set is not effective.",
          severity: "hard",
        },
      ],
      softScore: 0,
      ruleSetId: normalized.ruleSet.id,
      ruleSetVersion: normalized.ruleSet.version,
      ruleSetStatus: normalized.ruleSet.status,
      engineVersion: RULE_ENGINE_VERSION,
    });
  }

  const applicable = expandApplicableRules(normalized.ruleSet.constraints, normalized.context);
  const conflicts = detectConstraintConflicts(applicable, normalized.context);

  if (!options.skipConflictCheck && conflicts.length) {
    return aggregateResult({
      enabled: true,
      eligible: true,
      feasible: false,
      conflicts,
      softScore: 0,
      ruleSetId: normalized.ruleSet.id,
      ruleSetVersion: normalized.ruleSet.version,
      ruleSetStatus: normalized.ruleSet.status,
      engineVersion: RULE_ENGINE_VERSION,
    });
  }

  const eligibility = validateEligibility(normalized.context, applicable);
  if (!eligibility.eligible) {
    return aggregateResult({
      enabled: true,
      eligible: false,
      feasible: false,
      hardViolations: eligibility.violations,
      softScore: 0,
      ruleSetId: normalized.ruleSet.id,
      ruleSetVersion: normalized.ruleSet.version,
      ruleSetStatus: normalized.ruleSet.status,
      engineVersion: RULE_ENGINE_VERSION,
    });
  }

  const hard = validateHardConstraints(
    normalized.candidate,
    applicable,
    normalized.context
  );
  const soft = hard.feasible
    ? scoreSoftConstraints(normalized.candidate, applicable, normalized.context)
    : { total: 0, breakdown: { total: 0, components: {} }, notes: [] };

  return aggregateResult({
    enabled: true,
    eligible: true,
    feasible: hard.feasible,
    hardViolations: hard.violations,
    softScore: hard.feasible ? soft.total : 0,
    softBreakdown: soft.breakdown,
    softNotes: soft.notes,
    conflicts,
    ruleSetId: normalized.ruleSet.id,
    ruleSetVersion: normalized.ruleSet.version,
    ruleSetStatus: normalized.ruleSet.status,
    engineVersion: RULE_ENGINE_VERSION,
  });
}

export { resolveContext, normalizeInput, expandApplicableRules };
