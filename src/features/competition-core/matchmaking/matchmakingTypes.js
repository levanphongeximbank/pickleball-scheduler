/**
 * Daily matchmaking domain typedefs — CC-06.
 *
 * @typedef {Object} MatchmakingPolicy
 * @property {string} strategy
 * @property {string|null} competitionType
 * @property {boolean} persist
 * @property {number|null} courtCount
 * @property {Record<string, unknown>} [params]
 *
 * @typedef {Object} MatchmakingCourtAssignment
 * @property {string|number|null} courtId
 * @property {string|null} courtLabel
 * @property {string[]} teamAIds
 * @property {string[]} teamBIds
 * @property {number|null} diff
 * @property {number|null} score
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {Object} MatchmakingScoreBreakdown
 * @property {number|null} total
 * @property {number|null} balance
 * @property {number|null} history
 * @property {number|null} waiting
 * @property {number|null} rules
 * @property {number|null} pairingScore
 * @property {number|null} finalScore
 *
 * @typedef {Object} MatchmakingAudit
 * @property {string} engineVersion
 * @property {string} strategy
 * @property {unknown} seed
 * @property {MatchmakingScoreBreakdown|null} scores
 * @property {Record<string, unknown>} courtAllocation
 * @property {string[]} warnings
 * @property {string|null} [recordedAt]
 *
 * @typedef {Object} MatchmakingRequest
 * @property {string|null} sessionId
 * @property {string|null} clubId
 * @property {string|null} tournamentId
 * @property {MatchmakingPolicy} policy
 * @property {Array<Record<string, unknown>>} players
 * @property {Array<Record<string, unknown>>} courts
 * @property {string[]} [lockedCourtIds]
 * @property {string[]} [lockedPlayerIds]
 * @property {unknown} [randomSeed]
 * @property {Record<string, unknown>} [options]
 *
 * @typedef {Object} MatchmakingResult
 * @property {boolean} ok
 * @property {MatchmakingCourtAssignment[]} courts
 * @property {string[]} waitingPlayerIds
 * @property {MatchmakingScoreBreakdown|null} scores
 * @property {MatchmakingAudit} [audit]
 * @property {string[]} warnings
 * @property {string[]} errors
 * @property {Record<string, unknown>} [metadata]
 */

export {};
