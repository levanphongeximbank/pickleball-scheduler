/**
 * Seed domain typedefs — CC-04B foundation. Pure documentation types.
 *
 * @typedef {Object} SeedScoreComponents
 * @property {number|null} baseScore
 * @property {number|null} competitionEloComponent
 * @property {number|null} averageLevelComponent
 * @property {number|null} internalRatingComponent
 * @property {number|null} winRateComponent
 * @property {number|null} performanceComponent
 * @property {number|null} manualAdjustment
 * @property {number|null} provisionalPenalty
 * @property {number|null} newPlayerPenalty
 * @property {number|null} manualOverrideScore
 * @property {number|null} total
 * @property {Record<string, number>} [weights]
 *
 * @typedef {Object} SeedAdjustment
 * @property {string} kind
 * @property {number|null} value
 * @property {string} [reason]
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {Object} SeedRankingSnapshot
 * @property {number|null} rank
 * @property {number|null} seedScore
 * @property {string|null} primarySource
 * @property {Record<string, unknown>} [metrics]
 *
 * @typedef {Object} CanonicalSeedObject
 * @property {string|null} participantId
 * @property {string|null} entryId
 * @property {number|null} seedNumber
 * @property {number|null} seedScore
 * @property {string|null} seedReason
 * @property {string} source
 * @property {number|null} confidence
 * @property {SeedAdjustment[]} adjustments
 * @property {boolean} provisional
 * @property {boolean} manualOverride
 * @property {SeedRankingSnapshot|null} rankingSnapshot
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {Object} SeedTieBreak
 * @property {string} kind
 * @property {number} order
 * @property {string|null} winnerParticipantId
 * @property {string|null} loserParticipantId
 * @property {string|null} reason
 * @property {Record<string, unknown>} [details]
 *
 * @typedef {Object} SeedComputation
 * @property {string} participantId
 * @property {string} resolvedSource
 * @property {SeedScoreComponents} score
 * @property {SeedAdjustment[]} adjustments
 * @property {number|null} confidence
 * @property {boolean} provisional
 * @property {boolean} manualOverride
 * @property {string|null} seedReason
 *
 * @typedef {Object} SeedExplanation
 * @property {string} code
 * @property {string} title
 * @property {string} message
 * @property {string|null} participantId
 * @property {number|null} seedNumber
 * @property {string[]} path
 * @property {string[]} reasons
 * @property {number|null} finalScore
 * @property {Record<string, unknown>} [details]
 *
 * @typedef {Object} SeedAudit
 * @property {Record<string, unknown>} sourceValues
 * @property {Record<string, number>} weights
 * @property {SeedAdjustment[]} adjustments
 * @property {number|null} finalScore
 * @property {SeedTieBreak[]} tieBreaks
 * @property {string} engineVersion
 * @property {string|null} recordedAt
 *
 * @typedef {Object} SeedRequest
 * @property {string|null} tournamentId
 * @property {string|null} eventId
 * @property {string|null} clubId
 * @property {Array<Record<string, unknown>>} participants
 * @property {Record<string, number>} [weights]
 * @property {string[]} [tieBreakOrder]
 * @property {unknown} [randomSeed]
 * @property {Record<string, unknown>} [options]
 *
 * @typedef {Object} SeedResult
 * @property {boolean} ok
 * @property {CanonicalSeedObject[]} seeds
 * @property {SeedComputation[]} computations
 * @property {SeedExplanation[]} explanations
 * @property {SeedAudit} [audit]
 * @property {string[]} warnings
 * @property {string[]} errors
 * @property {Record<string, unknown>} [metadata]
 */

export {};
