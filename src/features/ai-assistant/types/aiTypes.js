/**
 * @typedef {"high"|"medium"|"low"} AiConfidence
 * @typedef {"manual_review"|"light_random"|"competitive_balanced"} GroupSuggestionMode
 * @typedef {"balanced"|"same_level"|"mixed_gender"|"avoid_repeat"|"light_random"} PairingStrategy
 * @typedef {"critical"|"warning"|"info"} ScheduleIssueSeverity
 * @typedef {"seed"|"pairing"|"group"|"time_prediction"|"schedule_validation"|"rule_suggestion"} AiSuggestionType
 * @typedef {"pending"|"applied"|"dismissed"|"expired"} AiSuggestionStatus
 */

/**
 * @typedef {Object} SeedSuggestionItem
 * @property {string} playerId
 * @property {number} seedRank
 * @property {number} aiScore
 * @property {AiConfidence} confidence
 * @property {string[]} reasons
 * @property {string[]} [warnings]
 */

/**
 * @typedef {Object} GroupSuggestionOutput
 * @property {string} suggestionId
 * @property {string} tournamentId
 * @property {GroupSuggestionMode} mode
 * @property {Array<{groupName:string,teamIds:string[],averageElo:number,strengthScore:number,warnings:string[]}>} groups
 * @property {number} overallBalanceScore
 * @property {string} explanation
 */

/**
 * @typedef {Object} PairingSuggestionOutput
 * @property {string} suggestionId
 * @property {PairingStrategy} strategy
 * @property {Array<{teamId?:string,playerIds:string[],combinedScore:number,confidence:AiConfidence,reasons:string[]}>} teams
 * @property {number} fairnessScore
 * @property {string[]} warnings
 * @property {string} explanation
 */

/**
 * @typedef {Object} AiSuggestionRecord
 * @property {string} id
 * @property {string} tenantId
 * @property {string} tournamentId
 * @property {AiSuggestionType} type
 * @property {AiSuggestionStatus} status
 * @property {Object} inputSnapshot
 * @property {Object} outputPayload
 * @property {AiConfidence} confidence
 * @property {string} createdBy
 * @property {string} createdAt
 * @property {string|null} appliedBy
 * @property {string|null} appliedAt
 * @property {string|null} dismissedBy
 * @property {string|null} dismissedAt
 * @property {string} expiresAt
 */

export {};
