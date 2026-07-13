/**
 * @typedef {'ROUND_ROBIN'|'GROUP_STAGE'|'KNOCKOUT'|'DOUBLE_ELIMINATION'|'SWISS'|'TEAM_TOURNAMENT'|'COURT_FIRST'|'TIME_FIRST'|'BALANCED'|'MANUAL'|'HYBRID'|'CUSTOM'} SchedulingStrategyValue
 * @typedef {'PLAYER_TIME_CONFLICT'|'TEAM_TIME_CONFLICT'|'COURT_TIME_CONFLICT'|'VENUE_TIME_CONFLICT'|'REFEREE_TIME_CONFLICT'|'INSUFFICIENT_REST'|'COURT_UNAVAILABLE'|'VENUE_UNAVAILABLE'|'INVALID_ROUND_ORDER'|'DUPLICATE_MATCH_ASSIGNMENT'|'UNASSIGNED_MATCH'|'INVALID_BYE_ASSIGNMENT'|'MANUAL_OVERRIDE_CONFLICT'|'DEPENDENCY_NOT_COMPLETED'|'UNKNOWN_PARTICIPANT'|'UNKNOWN_COURT'|'UNKNOWN_SLOT'} SchedulingConflictTypeValue
 * @typedef {'HARD'|'SOFT'|'INFO'} ConflictSeverityValue
 */

/**
 * @typedef {Object} SchedulingParticipant
 * @property {string} participantId
 * @property {string} [teamId]
 * @property {string} [name]
 * @property {number} [seed]
 * @property {boolean} [withdrawn]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} SchedulingCourt
 * @property {string} courtId
 * @property {string} [venueId]
 * @property {string} [name]
 * @property {boolean} [available]
 * @property {boolean} [locked]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} SchedulingSlot
 * @property {string} slotId
 * @property {string} [startTime]
 * @property {string} [endTime]
 * @property {number} [slotIndex]
 * @property {string} [timezone]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} SchedulingVenue
 * @property {string} venueId
 * @property {string} [name]
 * @property {string} [timezone]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} SchedulingMatch
 * @property {string} matchId
 * @property {string} [roundId]
 * @property {number} [roundNumber]
 * @property {string} [entryAId]
 * @property {string} [entryBId]
 * @property {string} [groupId]
 * @property {string} [status]
 * @property {boolean} [isBye]
 * @property {boolean} [pendingDependency]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} SchedulingRound
 * @property {string} roundId
 * @property {number} [roundNumber]
 * @property {string} [groupId]
 * @property {string[]} [matchIds]
 */

/**
 * @typedef {Object} SchedulingAssignment
 * @property {string} matchId
 * @property {string} [roundId]
 * @property {string} [courtId]
 * @property {string} [venueId]
 * @property {string} [startTime]
 * @property {string} [endTime]
 * @property {string} [slotId]
 * @property {string} [refereeId]
 * @property {string} [status]
 * @property {string[]} [warnings]
 * @property {boolean} [manualOverride]
 * @property {string} [source]
 */

/**
 * @typedef {Object} SchedulingConfiguration
 * @property {SchedulingStrategyValue} strategy
 * @property {string} [timezone]
 * @property {number} [matchDurationMinutes]
 * @property {number} [bufferMinutes]
 * @property {number} [restMinutes]
 * @property {string} [startTime]
 * @property {string} [endTime]
 * @property {Record<string, unknown>} [extensions]
 */

/**
 * @typedef {Object} SchedulingOverride
 * @property {string} overrideId
 * @property {string} [matchId]
 * @property {string} [field]
 * @property {unknown} [beforeValue]
 * @property {unknown} [afterValue]
 * @property {string} [reason]
 * @property {string} [actor]
 * @property {string} [timestamp]
 * @property {boolean} [locked]
 */

/**
 * @typedef {Object} SchedulingRequest
 * @property {string} [tournamentId]
 * @property {string} [eventId]
 * @property {string} [groupId]
 * @property {SchedulingStrategyValue} [strategy]
 * @property {SchedulingParticipant[]} [participants]
 * @property {SchedulingMatch[]} [matches]
 * @property {SchedulingCourt[]} [courts]
 * @property {SchedulingSlot[]} [slots]
 * @property {SchedulingVenue[]} [venues]
 * @property {SchedulingConfiguration} [configuration]
 * @property {SchedulingOverride[]} [manualOverrides]
 * @property {Record<string, unknown>} [legacyExtensions]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} SchedulingConflict
 * @property {SchedulingConflictTypeValue} type
 * @property {ConflictSeverityValue} severity
 * @property {string[]} [matchIds]
 * @property {string[]} [participantIds]
 * @property {string[]} [courtIds]
 * @property {string[]} [slotIds]
 * @property {string} message
 * @property {string} [reasonCode]
 * @property {string} [suggestedResolution]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} SchedulingExplanation
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} SchedulingDecisionTrace
 * @property {string} traceId
 * @property {string} engineVersion
 * @property {SchedulingStrategyValue} [strategy]
 * @property {string} [tournamentId]
 * @property {string} [eventId]
 * @property {string[]} [inputMatchIds]
 * @property {string[]} [courtSet]
 * @property {string[]} [slotSet]
 * @property {string} [timezone]
 * @property {SchedulingOverride[]} [manualOverrides]
 * @property {Array<Record<string, unknown>>} [assignmentSteps]
 * @property {SchedulingConflict[]} [conflictsDetected]
 * @property {SchedulingConflict[]} [conflictsResolved]
 * @property {SchedulingConflict[]} [unresolvedConflicts]
 * @property {Array<Record<string, unknown>>} [byeHandling]
 * @property {Array<Record<string, unknown>>} [dependencyHandling]
 * @property {SchedulingAssignment[]} [finalAssignments]
 * @property {string[]} [unassignedMatches]
 * @property {string[]} [warnings]
 * @property {string} [parityStatus]
 * @property {string} [timestamp]
 */

/**
 * @typedef {Object} SchedulingAudit
 * @property {string} engineVersion
 * @property {string} [consumer]
 * @property {string} [executionPath]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} SchedulingSnapshot
 * @property {string} snapshotId
 * @property {string} engineVersion
 * @property {SchedulingRequest} request
 * @property {SchedulingResult} result
 * @property {string} [timestamp]
 */

/**
 * @typedef {Object} SchedulingResult
 * @property {boolean} ok
 * @property {SchedulingRound[]} [rounds]
 * @property {SchedulingMatch[]} [matches]
 * @property {SchedulingAssignment[]} [assignments]
 * @property {string[]} [unassignedMatches]
 * @property {string[]} [byes]
 * @property {SchedulingConflict[]} [conflicts]
 * @property {SchedulingExplanation[]} [explanations]
 * @property {SchedulingDecisionTrace} [decisionTrace]
 * @property {SchedulingAudit} [audit]
 * @property {string[]} [warnings]
 * @property {string[]} [errors]
 * @property {SchedulingOverride[]} [manualOverrides]
 * @property {Record<string, unknown>} [metadata]
 */

export {};
