/**
 * Team formation domain typedefs — CC-05A foundation.
 *
 * @typedef {Object} FormationPolicy
 * @property {string} strategy
 * @property {boolean} allowRandomization
 * @property {number|null} maxSkillGap
 * @property {number|null} targetCourtCount
 * @property {Record<string, unknown>} [params]
 *
 * @typedef {Object} FormationStrategyDefinition
 * @property {string} id
 * @property {string} name
 * @property {boolean} supportsPairs
 * @property {boolean} supportsTeams
 * @property {boolean} supportsRotation
 * @property {boolean} supportsConstraints
 * @property {boolean} supportsRandomization
 * @property {string} [legacyKey]
 *
 * @typedef {Object} FormationConstraint
 * @property {string|null} id
 * @property {string} kind
 * @property {string} severity
 * @property {boolean} enabled
 * @property {Record<string, unknown>} [params]
 * @property {string} [message]
 *
 * @typedef {Object} FormationPair
 * @property {string|null} id
 * @property {string[]} playerIds
 * @property {number|null} averageSkill
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {Object} FormationCourt
 * @property {string|null} id
 * @property {string|null} label
 * @property {number|null} index
 * @property {string[]} playerIds
 * @property {FormationPair[]} [pairs]
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {Object} FormationRound
 * @property {string|null} id
 * @property {number|null} roundNumber
 * @property {FormationCourt[]} courts
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {Object} FormationCandidate
 * @property {string|null} id
 * @property {FormationPair[]} pairs
 * @property {FormationCourt[]} courts
 * @property {number|null} score
 * @property {boolean} feasible
 * @property {import('./formationTypes.js').FormationExplanation[]} explanations
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {Object} FormationScoreBreakdown
 * @property {number|null} skillScore
 * @property {number|null} repeatPenalty
 * @property {number|null} opponentPenalty
 * @property {number|null} restPenalty
 * @property {number|null} genderBonus
 * @property {number|null} balanceScore
 * @property {number|null} availabilityScore
 * @property {number|null} manualAdjustment
 * @property {number|null} randomComponent
 * @property {number|null} finalScore
 *
 * @typedef {Object} FormationExplanation
 * @property {string} code
 * @property {string} title
 * @property {string} message
 * @property {string|null} [playerAId]
 * @property {string|null} [playerBId]
 * @property {string[]} [decisionPath]
 * @property {string[]} [reasons]
 * @property {FormationScoreBreakdown} [scoreBreakdown]
 * @property {Record<string, unknown>} [details]
 *
 * @typedef {Object} FormationDecisionTraceRecord
 * @property {string} id
 * @property {string} action
 * @property {string[]} path
 * @property {string} engineVersion
 * @property {string} evaluatedAt
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {Object} FormationDecisionTrace
 * @property {FormationDecisionTraceRecord[]} records
 * @property {string} traceVersion
 *
 * @typedef {Object} FormationAudit
 * @property {string} engineVersion
 * @property {string} strategy
 * @property {unknown} seed
 * @property {Record<string, unknown>} constraints
 * @property {FormationScoreBreakdown|null} scores
 * @property {Record<string, unknown>} courtAllocation
 * @property {string[]} warnings
 * @property {string|null} [recordedAt]
 *
 * @typedef {Object} FormationRequest
 * @property {string|null} sessionId
 * @property {string|null} clubId
 * @property {string|null} eventId
 * @property {FormationPolicy} policy
 * @property {Array<Record<string, unknown>>} players
 * @property {FormationConstraint[]} constraints
 * @property {FormationPair[]} [lockedPairs]
 * @property {FormationCourt[]} [courts]
 * @property {unknown} [randomSeed]
 * @property {Record<string, unknown>} [options]
 *
 * @typedef {Object} FormationResult
 * @property {boolean} ok
 * @property {FormationPair[]} pairs
 * @property {FormationCourt[]} courts
 * @property {FormationRound[]} rounds
 * @property {FormationCandidate|null} selectedCandidate
 * @property {FormationCandidate[]} [candidates]
 * @property {FormationExplanation[]} explanations
 * @property {FormationAudit} [audit]
 * @property {FormationDecisionTrace} [decisionTrace]
 * @property {string[]} warnings
 * @property {string[]} errors
 * @property {Record<string, unknown>} [metadata]
 */

export {};
