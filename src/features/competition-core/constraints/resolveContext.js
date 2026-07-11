import { CONSTRAINT_SCOPE } from "../constants/constraintScope.js";

/**
 * @typedef {import('../types/index.js').ConstraintContext} ConstraintContext
 * @typedef {import('./evaluateHardRules.js').RuleEvaluationContext} RuleEvaluationContext
 */

/**
 * Resolve raw evaluation input into a canonical ConstraintContext.
 *
 * @param {Partial<ConstraintContext> & Partial<RuleEvaluationContext>} [raw]
 * @returns {ConstraintContext}
 */
export function resolveContext(raw = {}) {
  const scope = raw.scope || CONSTRAINT_SCOPE.PAIRING;

  return {
    scope,
    tenantId: raw.tenantId ? String(raw.tenantId) : undefined,
    clubId: raw.clubId ? String(raw.clubId) : undefined,
    tournamentId: raw.tournamentId ? String(raw.tournamentId) : undefined,
    eventId: raw.eventId ? String(raw.eventId) : undefined,
    sessionId: raw.sessionId ? String(raw.sessionId) : undefined,
    venueId: raw.venueId ? String(raw.venueId) : undefined,
    competitionType: raw.competitionType ? String(raw.competitionType) : undefined,
    gender: raw.gender ? String(raw.gender) : undefined,
    ageGroup: raw.ageGroup ? String(raw.ageGroup) : undefined,
    skillMin: raw.skillMin != null ? Number(raw.skillMin) : undefined,
    skillMax: raw.skillMax != null ? Number(raw.skillMax) : undefined,
    evaluatedAt: raw.evaluatedAt ? String(raw.evaluatedAt) : new Date().toISOString(),
    teamSize: raw.teamSize != null ? Number(raw.teamSize) : 2,
    playersById: raw.playersById ? { ...raw.playersById } : {},
    groups: Array.isArray(raw.groups) ? raw.groups.map((group) => ({ ...group })) : undefined,
    lineupSlots: Array.isArray(raw.lineupSlots)
      ? raw.lineupSlots.map((slot) => ({ ...slot }))
      : undefined,
    entriesByPlayerId: raw.entriesByPlayerId ? { ...raw.entriesByPlayerId } : undefined,
    partnerRepeatCounts: raw.partnerRepeatCounts ? { ...raw.partnerRepeatCounts } : undefined,
    opponentRepeatCounts: raw.opponentRepeatCounts ? { ...raw.opponentRepeatCounts } : undefined,
  };
}

/**
 * Convert ConstraintContext to RuleEvaluationContext for evaluators.
 *
 * @param {ConstraintContext} context
 * @param {import('../types/index.js').CandidateAssignment} [candidate]
 * @returns {RuleEvaluationContext}
 */
export function toRuleEvaluationContext(context, candidate = {}) {
  return {
    scope: context.scope,
    teams: candidate.teams,
    groups: candidate.groups ?? context.groups,
    matchOption: candidate.matchOption,
    playersById: context.playersById,
    teamSize: context.teamSize,
    lineupSlots: context.lineupSlots,
    entriesByPlayerId: context.entriesByPlayerId,
    partnerRepeatCounts: context.partnerRepeatCounts,
    opponentRepeatCounts: context.opponentRepeatCounts,
    evaluatedAt: context.evaluatedAt,
  };
}
