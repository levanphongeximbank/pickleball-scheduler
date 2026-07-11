import { COMPETITION_CONSTRAINT_TYPE } from "../constants/constraintType.js";
import { CONSTRAINT_SEVERITY } from "../constants/constraintSeverity.js";
import { createEngineValidationResult } from "../contracts/engineContracts.js";
import { evaluateHardRules } from "./evaluateHardRules.js";
import { toRuleEvaluationContext } from "./resolveContext.js";
import { buildExplanation, toConstraintExplanation } from "./buildExplanation.js";

/**
 * @typedef {import('../types/index.js').ConstraintDefinition} ConstraintDefinition
 * @typedef {import('../types/index.js').ConstraintContext} ConstraintContext
 * @typedef {import('../types/index.js').CandidateAssignment} CandidateAssignment
 */

/**
 * Validate entry-level eligibility before candidate scoring.
 *
 * @param {ConstraintContext} context
 * @param {ConstraintDefinition[]} [constraints]
 * @returns {{ eligible: boolean, validation: import('../types/index.js').EngineValidationResult, violations: import('../types/index.js').ConstraintExplanation[] }}
 */
export function validateEligibility(context, constraints = []) {
  const entryRules = (constraints || []).filter(
    (item) =>
      item?.enabled !== false &&
      item.type === COMPETITION_CONSTRAINT_TYPE.ENTRY_ELIGIBILITY &&
      item.severity === CONSTRAINT_SEVERITY.HARD
  );

  const evalContext = toRuleEvaluationContext(context, {
    playerIds: Object.keys(context.entriesByPlayerId || context.playersById || {}),
  });

  const hard = evaluateHardRules(entryRules, evalContext);
  const violations = hard.violations.map((item) =>
    toConstraintExplanation(item, CONSTRAINT_SEVERITY.HARD)
  );

  return {
    eligible: hard.feasible,
    validation: createEngineValidationResult({
      ok: hard.feasible,
      errors: violations.map((item) => item.message),
    }),
    violations,
  };
}

/**
 * @param {CandidateAssignment} candidate
 * @param {ConstraintDefinition[]} constraints
 * @param {ConstraintContext} context
 * @returns {{ feasible: boolean, violations: import('../types/index.js').ConstraintExplanation[] }}
 */
export function validateHardConstraints(candidate, constraints, context) {
  const evalContext = toRuleEvaluationContext(context, candidate);
  const hard = evaluateHardRules(constraints, evalContext);
  return {
    feasible: hard.feasible,
    violations: hard.violations.map((item) =>
      toConstraintExplanation(item, CONSTRAINT_SEVERITY.HARD)
    ),
  };
}
