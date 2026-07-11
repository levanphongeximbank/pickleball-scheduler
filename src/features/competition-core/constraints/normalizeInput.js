import { normalizeRuleSet } from "./normalizeRule.js";
import { resolveContext } from "./resolveContext.js";

/**
 * @typedef {import('../types/index.js').RuleSet} RuleSet
 * @typedef {import('../types/index.js').ConstraintContext} ConstraintContext
 * @typedef {import('../types/index.js').CandidateAssignment} CandidateAssignment
 */

/**
 * @typedef {Object} NormalizedRuleInput
 * @property {RuleSet} ruleSet
 * @property {ConstraintContext} context
 * @property {CandidateAssignment} candidate
 * @property {Record<string, unknown>} [envSource]
 */

/**
 * @param {Object} [input]
 * @param {RuleSet|Partial<RuleSet>} [input.ruleSet]
 * @param {Partial<ConstraintContext>} [input.context]
 * @param {Partial<CandidateAssignment>} [input.candidate]
 * @param {Record<string, unknown>} [input.envSource]
 * @returns {NormalizedRuleInput}
 */
export function normalizeInput(input = {}) {
  return {
    ruleSet: normalizeRuleSet(input.ruleSet || {}),
    context: resolveContext(input.context || {}),
    candidate: {
      teams: Array.isArray(input.candidate?.teams)
        ? input.candidate.teams.map((team) => team.map(String))
        : undefined,
      groups: Array.isArray(input.candidate?.groups)
        ? input.candidate.groups.map((group) => ({ ...group }))
        : undefined,
      matchOption: input.candidate?.matchOption
        ? {
            teamA: (input.candidate.matchOption.teamA || []).map(String),
            teamB: (input.candidate.matchOption.teamB || []).map(String),
          }
        : undefined,
      playerIds: Array.isArray(input.candidate?.playerIds)
        ? input.candidate.playerIds.map(String)
        : undefined,
    },
    envSource: input.envSource,
  };
}
