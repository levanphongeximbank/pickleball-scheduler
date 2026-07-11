/**
 * @typedef {import('./drawMode.js').DrawModeValue} DrawModeValue
 * @typedef {import('./engineType.js').CompetitionEngineTypeValue} CompetitionEngineTypeValue
 * @typedef {import('./constraintType.js').CompetitionConstraintTypeValue} CompetitionConstraintTypeValue
 * @typedef {import('./constraintSeverity.js').ConstraintSeverityValue} ConstraintSeverityValue
 * @typedef {import('./ratingSource.js').RatingSourceValue} RatingSourceValue
 * @typedef {import('./ratingStatus.js').CompetitionRatingStatusValue} CompetitionRatingStatusValue
 * @typedef {import('./ratingEligibilityStatus.js').RatingEligibilityStatusValue} RatingEligibilityStatusValue
 * @typedef {import('./engineRunStatus.js').EngineRunStatusValue} EngineRunStatusValue
 */

/**
 * @typedef {Object} DrawConfiguration
 * @property {DrawModeValue} [mode]
 * @property {number} [groupCount]
 * @property {number} [randomSeed]
 * @property {string} [ruleSetId]
 * @property {string} [ruleSetVersion]
 */

/**
 * @typedef {Object} ConstraintDefinition
 * @property {string} [id]
 * @property {CompetitionConstraintTypeValue} type
 * @property {ConstraintSeverityValue} severity
 * @property {boolean} [enabled]
 * @property {Record<string, unknown>} [params]
 */

/**
 * @typedef {Object} ConstraintConflict
 * @property {string} code
 * @property {string} message
 * @property {ConstraintDefinition[]} [constraints]
 */

/**
 * @typedef {Object} RatingSnapshot
 * @property {number|null} [publicSkillLevel]
 * @property {number|null} [competitionElo]
 * @property {number|null} [dailyPlayRating]
 * @property {number|null} [ratingConfidence]
 * @property {CompetitionRatingStatusValue|null} [ratingStatus]
 * @property {number|null} [provisionalSkillLevel]
 * @property {RatingSourceValue|null} [source]
 * @property {string|null} [capturedAt]
 */

/**
 * @typedef {Object} EngineValidationResult
 * @property {boolean} ok
 * @property {string[]} [errors]
 * @property {string[]} [warnings]
 * @property {ConstraintConflict[]} [conflicts]
 */

/**
 * @typedef {Object} EngineScoreBreakdown
 * @property {number} [total]
 * @property {Record<string, number>} [components]
 */

/**
 * @typedef {Object} EngineExplanation
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} EngineRunMetadata
 * @property {string} [engineVersion]
 * @property {string} [ruleSetVersion]
 * @property {number} [randomSeed]
 * @property {string} [generatedAt]
 * @property {string} [generatedBy]
 * @property {string} [featureFlag]
 * @property {string} [legacyEngine]
 * @property {EngineRunStatusValue} [status]
 */

/**
 * @typedef {Object} CompetitionEngineInput
 * @property {CompetitionEngineTypeValue} engineType
 * @property {string} [tournamentId]
 * @property {string} [clubId]
 * @property {string} [eventId]
 * @property {DrawConfiguration} [draw]
 * @property {Record<string, unknown>} [payload]
 * @property {ConstraintDefinition[]} [constraints]
 * @property {EngineRunMetadata} [metadata]
 */

/**
 * @typedef {Object} CompetitionEngineResult
 * @property {boolean} success
 * @property {CompetitionEngineTypeValue} engineType
 * @property {string} engineVersion
 * @property {unknown} [result]
 * @property {EngineValidationResult} [validation]
 * @property {number|null} [score]
 * @property {EngineScoreBreakdown} [scoreBreakdown]
 * @property {EngineExplanation[]} [explanations]
 * @property {string[]} [warnings]
 * @property {EngineRunMetadata} [metadata]
 * @property {string|null} [error]
 * @property {'legacy'|'v2'} [executionPath]
 */

export {};
