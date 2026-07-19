/**
 * @typedef {import('./constraintScope.js').ConstraintScopeValue} ConstraintScopeValue
 * @typedef {import('./ruleSetStatus.js').RuleSetStatusValue} RuleSetStatusValue
 * @typedef {import('./engineType.js').CompetitionEngineTypeValue} CompetitionEngineTypeValue
 * @typedef {import('./constraintType.js').CompetitionConstraintTypeValue} CompetitionConstraintTypeValue
 * @typedef {import('./constraintSeverity.js').ConstraintSeverityValue} ConstraintSeverityValue
 * @typedef {import('./ratingSource.js').RatingSourceValue} RatingSourceValue
 * @typedef {import('./ratingStatus.js').CompetitionRatingStatusValue} CompetitionRatingStatusValue
 * @typedef {import('./ratingEligibilityStatus.js').RatingEligibilityStatusValue} RatingEligibilityStatusValue
 * @typedef {import('./engineRunStatus.js').EngineRunStatusValue} EngineRunStatusValue
 * @typedef {import('./drawMode.js').DrawModeValue} DrawModeValue
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
 * @typedef {Object} ConstraintApplicability
 * @property {string} [tenantId]
 * @property {string} [clubId]
 * @property {string} [tournamentId]
 * @property {string} [competitionId]
 * @property {string} [eventId]
 * @property {string} [sessionId]
 * @property {string} [venueId]
 * @property {string} [competitionType]
 * @property {string} [gender]
 * @property {string} [ageGroup]
 * @property {number} [skillMin]
 * @property {number} [skillMax]
 * @property {string} [effectiveFrom]
 * @property {string} [effectiveTo]
 */

/**
 * @typedef {Object} ConstraintDefinition
 * @property {string} [id]
 * @property {CompetitionConstraintTypeValue} type
 * @property {ConstraintSeverityValue} severity
 * @property {boolean} [enabled]
 * @property {ConstraintScopeValue} [scope]
 * @property {ConstraintApplicability} [applicability]
 * @property {Record<string, unknown>} [params]
 * @property {string[]} [operations]
 * @property {string} [source]
 * @property {number} [sourcePriority]
 * @property {string|number} [priority]
 * @property {string} [ruleSetId]
 * @property {string} [ruleSetVersion]
 * @property {string} [updatedAt]
 * @property {Record<string, unknown>} [metadata]
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
 * @typedef {Object} ConstraintExplanation
 * @property {string} reasonCode
 * @property {string} title
 * @property {string} message
 * @property {ConstraintSeverityValue} severity
 * @property {string[]} [affectedPlayers]
 * @property {string} [suggestedResolution]
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} ConstraintEvaluationResult
 * @property {boolean} enabled
 * @property {boolean} eligible
 * @property {boolean} feasible
 * @property {EngineValidationResult} validation
 * @property {ConstraintExplanation[]} hardViolations
 * @property {number} softScore
 * @property {EngineScoreBreakdown} [softBreakdown]
 * @property {ConstraintExplanation[]} softNotes
 * @property {ConstraintExplanation[]} explanations
 * @property {string} engineVersion
 * @property {string} ruleSetId
 * @property {string} ruleSetVersion
 * @property {RuleSetStatusValue} [ruleSetStatus]
 */

/**
 * @typedef {Object} ConstraintContext
 * @property {ConstraintScopeValue} scope
 * @property {string} [tenantId]
 * @property {string} [clubId]
 * @property {string} [tournamentId]
 * @property {string} [competitionId]
 * @property {string} [eventId]
 * @property {string} [sessionId]
 * @property {string} [venueId]
 * @property {string} [competitionType]
 * @property {string} [gender]
 * @property {string} [ageGroup]
 * @property {number} [skillMin]
 * @property {number} [skillMax]
 * @property {string} [evaluatedAt]
 * @property {number} [teamSize]
 * @property {Record<string, import('../constraints/evaluateHardRules.js').RulePlayerSnapshot>} [playersById]
 * @property {Array<{ id?: string, label?: string, playerIds?: string[] }>} [groups]
 * @property {Array<{ playerId: string, position?: string, required?: boolean }>} [lineupSlots]
 * @property {Record<string, { eligible?: boolean, reason?: string }>} [entriesByPlayerId]
 * @property {Record<string, Record<string, number>>} [partnerRepeatCounts]
 * @property {Record<string, Record<string, number>>} [opponentRepeatCounts]
 */

/**
 * @typedef {Object} RuleSet
 * @property {string} id
 * @property {string} version
 * @property {RuleSetStatusValue} [status]
 * @property {string} [effectiveFrom]
 * @property {string} [lockedAt]
 * @property {ConstraintDefinition[]} constraints
 * @property {Record<string, unknown>} [metadata]
 * @property {string} [source]
 * @property {number} [sourcePriority]
 */

/**
 * @typedef {Object} CandidateAssignment
 * @property {string[][]} [teams]
 * @property {Array<{ id?: string, label?: string, playerIds?: string[] }>} [groups]
 * @property {{ teamA?: string[], teamB?: string[] }} [matchOption]
 * @property {string[]} [playerIds]
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
