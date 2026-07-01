/**
 * Tournament Engine 4.0 — shared types (JSDoc).
 * Project uses JavaScript; types are for IDE hints only.
 */

/**
 * @typedef {Object} SeedWeights
 * @property {number} elo
 * @property {number} skillLevel
 * @property {number} winRate
 * @property {number} recentPerformance
 * @property {number} manualPriority
 */

/**
 * @typedef {Object} RankingRules
 * @property {string[]} criteria
 * @property {number} qualifiersPerGroup
 */

/**
 * @typedef {Object} ScheduleConfig
 * @property {string} startTime
 * @property {string} endTime
 * @property {number} averageMatchMinutes
 * @property {number} bufferMinutes
 * @property {number} restRoundsBetweenMatches
 * @property {number} [randomSeed]
 * @property {string} [date]
 */

/**
 * @typedef {Object} EngineParticipant
 * @property {string} id
 * @property {string} name
 * @property {string[]} [playerIds]
 * @property {number|null} [elo]
 * @property {number|null} [skillLevel]
 * @property {number} [winRate]
 * @property {number} [matchesPlayed]
 * @property {number} [recentPerformance]
 * @property {number} [manualPriority]
 * @property {string} [clubName]
 * @property {string} [gender]
 * @property {string} [status]
 * @property {number|null} [seed]
 * @property {boolean} [manualSeedOverride]
 * @property {boolean} [unseeded]
 */

/**
 * @typedef {Object} EngineCourt
 * @property {string} id
 * @property {string} name
 * @property {boolean} [locked]
 * @property {number} [priority]
 */

/**
 * @typedef {Object} EngineContext
 * @property {string} tournamentId
 * @property {string} [clubId]
 * @property {string} [eventId]
 * @property {string} [eventType]
 * @property {EngineParticipant[]} participants
 * @property {EngineCourt[]} courts
 * @property {ScheduleConfig} [scheduleConfig]
 * @property {SeedWeights} [seedWeights]
 * @property {RankingRules} [rankingRules]
 * @property {number} [groupCount]
 * @property {Object} [pointsConfig]
 * @property {Object[]} [matches]
 * @property {Object[]} [groups]
 * @property {Object} [engineState]
 */

/**
 * @typedef {Object} EngineResult
 * @property {boolean} ok
 * @property {*} [data]
 * @property {number} [score]
 * @property {string[]} [warnings]
 * @property {string[]} [errors]
 * @property {string[]} [explain]
 */

export {};
