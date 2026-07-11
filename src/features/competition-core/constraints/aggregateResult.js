import { createEngineValidationResult } from "../contracts/engineContracts.js";
import { buildExplanation } from "./buildExplanation.js";
import { RULE_ENGINE_VERSION } from "./ruleConstants.js";

/**
 * @typedef {import('../types/index.js').ConstraintEvaluationResult} ConstraintEvaluationResult
 * @typedef {import('../types/index.js').RuleSet} RuleSet
 */

/**
 * @param {Object} input
 * @returns {ConstraintEvaluationResult}
 */
export function aggregateResult(input) {
  const hardViolations = input.hardViolations || [];
  const softNotes = input.softNotes || [];
  const conflicts = input.conflicts || [];
  const explanations = buildExplanation({ hardViolations, softNotes, conflicts });

  const feasible = input.feasible !== false;
  const eligible = input.eligible !== false;

  return {
    enabled: input.enabled === true,
    eligible,
    feasible,
    validation: createEngineValidationResult({
      ok: feasible && eligible && conflicts.length === 0,
      errors: hardViolations.map((item) => item.message),
      conflicts,
    }),
    hardViolations,
    softScore: Number(input.softScore ?? 0),
    softBreakdown: input.softBreakdown,
    softNotes,
    explanations,
    engineVersion: input.engineVersion || RULE_ENGINE_VERSION,
    ruleSetId: String(input.ruleSetId || ""),
    ruleSetVersion: String(input.ruleSetVersion || ""),
    ruleSetStatus: input.ruleSetStatus,
  };
}
