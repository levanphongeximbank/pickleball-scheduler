import { CONSTRAINT_SEVERITY } from "../constants/constraintSeverity.js";
import { scoreSoftRules } from "./scoreSoftRules.js";
import { toRuleEvaluationContext } from "./resolveContext.js";
import { toConstraintExplanation } from "./buildExplanation.js";

/**
 * @typedef {import('../types/index.js').ConstraintDefinition} ConstraintDefinition
 * @typedef {import('../types/index.js').ConstraintContext} ConstraintContext
 * @typedef {import('../types/index.js').CandidateAssignment} CandidateAssignment
 */

/**
 * @param {CandidateAssignment} candidate
 * @param {ConstraintDefinition[]} constraints
 * @param {ConstraintContext} context
 * @returns {{ total: number, breakdown: import('../types/index.js').EngineScoreBreakdown, notes: import('../types/index.js').ConstraintExplanation[] }}
 */
export function scoreSoftConstraints(candidate, constraints, context) {
  const evalContext = toRuleEvaluationContext(context, candidate);
  const soft = scoreSoftRules(constraints, evalContext);
  return {
    total: soft.total,
    breakdown: soft.breakdown,
    notes: soft.notes.map((item) => toConstraintExplanation(item, CONSTRAINT_SEVERITY.SOFT)),
  };
}

/** @deprecated CC-03A alias */
export { scoreSoftRules };
