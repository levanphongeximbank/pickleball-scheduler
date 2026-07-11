/**
 * Draw domain typedefs — CC-04A foundation. Pure documentation types.
 *
 * @typedef {Object} DrawSeed
 * @property {string|null} entryId
 * @property {string|null} playerId
 * @property {number|null} seedNumber
 * @property {string} source
 * @property {number|null} averageLevel
 * @property {number|null} competitionElo
 * @property {number|null} winRate
 * @property {number|null} performanceScore
 * @property {boolean} provisional
 * @property {boolean} newPlayer
 * @property {number|null} manualAdjustment
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {Object} DrawGroup
 * @property {string|null} id
 * @property {string|null} label
 * @property {number|null} index
 * @property {string[]} entryIds
 * @property {string[]} playerIds
 * @property {number[]} seedNumbers
 * @property {number|null} averageLevel
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {Object} DrawExplanation
 * @property {string} code
 * @property {string} title
 * @property {string} message
 * @property {string} [entryId]
 * @property {string} [playerId]
 * @property {number} [seedNumber]
 * @property {string} [groupId]
 * @property {string[]} distributionPath
 * @property {string[]} reasons
 * @property {Record<string, unknown>} [details]
 *
 * @typedef {Object} DrawConstraint
 * @property {string|null} id
 * @property {string} category
 * @property {string} type
 * @property {string} severity
 * @property {boolean} enabled
 * @property {Record<string, unknown>} [params]
 * @property {string} [message]
 *
 * @typedef {Object} DrawConflict
 * @property {string} code
 * @property {string} message
 * @property {string} severity
 * @property {DrawConstraint[]} constraints
 * @property {string[]} affectedEntryIds
 * @property {Record<string, unknown>} [details]
 *
 * @typedef {Object} DrawScoreBreakdown
 * @property {number|null} total
 * @property {Record<string, number>} components
 * @property {number|null} heuristicScore
 * @property {number|null} balanceScore
 * @property {number|null} constraintPenalty
 *
 * @typedef {Object} DrawCandidate
 * @property {string|null} id
 * @property {DrawGroup[]} groups
 * @property {number|null} score
 * @property {boolean} feasible
 * @property {DrawExplanation[]} explanations
 * @property {DrawConflict[]} conflicts
 * @property {DrawScoreBreakdown} [scoreBreakdown]
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {Object} DrawRandomMetadata
 * @property {unknown} randomSeed
 * @property {string} generator
 * @property {string|null} algorithmVersion
 * @property {boolean} deterministic
 * @property {string} [notes]
 *
 * @typedef {Object} DrawStrategy
 * @property {string} kind
 * @property {string|null} id
 * @property {string} name
 * @property {string} version
 * @property {Record<string, unknown>} [params]
 * @property {boolean} implemented
 *
 * @typedef {Object} DrawMetadata
 * @property {string|null} drawId
 * @property {string} drawVersion
 * @property {string} engineVersion
 * @property {unknown} randomSeed
 * @property {string|null} startedAt
 * @property {string|null} finishedAt
 * @property {number|null} durationMs
 * @property {number} retryCount
 * @property {number|null} heuristicScore
 * @property {string} drawMode
 * @property {DrawStrategy} [strategy]
 * @property {DrawStrategy[]} [strategies]
 * @property {string} ruleSetVersion
 * @property {string|null} competitionVersion
 * @property {DrawRandomMetadata} [random]
 *
 * @typedef {Object} DrawAudit
 * @property {Record<string, unknown>} requestSnapshot
 * @property {DrawSeed[]} resolvedSeeds
 * @property {string[]} distributionPath
 * @property {Record<string, unknown>} [constraintEvaluation]
 * @property {Record<string, unknown>[]} retryHistory
 * @property {DrawCandidate|null} selectedCandidate
 * @property {number|null} finalScore
 * @property {unknown} randomSeed
 * @property {string} engineVersion
 * @property {DrawExplanation[]} explanations
 * @property {string|null} recordedAt
 *
 * @typedef {Object} DrawRequest
 * @property {string|null} tournamentId
 * @property {string|null} eventId
 * @property {string|null} clubId
 * @property {string} drawMode
 * @property {number|null} groupCount
 * @property {Record<string, unknown>[]} entries
 * @property {Record<string, unknown>[]} players
 * @property {DrawSeed[]} seeds
 * @property {DrawConstraint[]} constraints
 * @property {DrawStrategy[]} strategies
 * @property {DrawRandomMetadata} [random]
 * @property {DrawMetadata} [metadata]
 * @property {Record<string, unknown>} [options]
 *
 * @typedef {Object} DrawResult
 * @property {boolean} ok
 * @property {DrawGroup[]} groups
 * @property {DrawCandidate|null} selectedCandidate
 * @property {DrawCandidate[]} candidates
 * @property {DrawScoreBreakdown} [scoreBreakdown]
 * @property {DrawExplanation[]} explanations
 * @property {DrawConflict[]} conflicts
 * @property {DrawAudit} [audit]
 * @property {DrawMetadata} [metadata]
 * @property {string[]} warnings
 * @property {string[]} errors
 *
 * @typedef {Object} DrawEngineResult
 * @property {boolean} success
 * @property {boolean} enabled
 * @property {string} engineVersion
 * @property {string} executionPath
 * @property {DrawRequest} [request]
 * @property {DrawResult} [result]
 * @property {DrawAudit} [audit]
 * @property {DrawMetadata} [metadata]
 * @property {unknown} error
 */

export {};
