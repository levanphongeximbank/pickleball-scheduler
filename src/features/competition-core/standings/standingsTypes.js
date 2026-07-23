/**
 * @typedef {'COMPLETED'|'BYE'|'WALKOVER'|'NO_SHOW'|'RETIREMENT'|'FORFEIT'|'FORFEIT_BEFORE_START'|'FORFEIT_AFTER_START'|'ADMINISTRATIVE_FORFEIT'|'ABANDONED'|'CANCELLED'|'VOID'|'UNVERIFIED'|'LEGACY_FORFEIT'} MatchResultTypeValue
 * @typedef {'TOTAL_POINTS'|'HEAD_TO_HEAD'|'MINI_TABLE'|'SET_DIFFERENCE'|'GAME_DIFFERENCE'|'POINT_DIFFERENCE'|'SCORE_FOR'|'FEWER_FORFEITS'|'ORIGINAL_SEED'|'DRAW_LOT'|'CUSTOM'} TieBreakTypeValue
 * @typedef {'QUALIFIED'|'ELIMINATED'|'PENDING'|'TIE_BREAK_REQUIRED'} QualificationStatusValue
 * @typedef {'individual_group'|'team_tournament'|'season_league'} StandingsScopeValue
 */

/**
 * @typedef {Object} ScoringRule
 * @property {string} scoringRuleId
 * @property {string} scoringRuleVersion
 * @property {number} winPoints
 * @property {number} lossPoints
 * @property {number} drawPoints
 * @property {number} forfeitPoints
 * @property {number} walkoverPoints
 * @property {number} byePoints
 * @property {boolean} [completedMatchRequired]
 * @property {boolean} [verifiedResultRequired]
 */

/**
 * @typedef {Object} TieBreakRule
 * @property {string} id
 * @property {TieBreakTypeValue} type
 * @property {number} priority
 * @property {boolean} enabled
 * @property {Record<string, unknown>} [parameters]
 * @property {string} [scope]
 * @property {string} [version]
 * @property {string} [explanationTemplate]
 * @property {string} [legacyKey]
 */

/**
 * @typedef {Object} TieBreakStep
 * @property {string} ruleId
 * @property {TieBreakTypeValue} type
 * @property {string[]} entryIds
 * @property {boolean} resolved
 * @property {string} [winnerEntryId]
 * @property {string} [explanation]
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} TieBreakResult
 * @property {boolean} resolved
 * @property {string[]} orderedEntryIds
 * @property {TieBreakStep[]} steps
 * @property {string[]} [unresolvedEntryIds]
 */

/**
 * @typedef {Object} StandingsEntry
 * @property {string} entryId
 * @property {string} [teamId]
 * @property {string} [playerId]
 * @property {string} [name]
 * @property {number} [seed]
 */

/**
 * @typedef {Object} StandingsMatchRecord
 * @property {string} matchId
 * @property {string} entryAId
 * @property {string} entryBId
 * @property {MatchResultTypeValue} resultType
 * @property {string} [winnerEntryId]
 * @property {string} [loserEntryId]
 * @property {number} [scoreA]
 * @property {number} [scoreB]
 * @property {number} [gamesA]
 * @property {number} [gamesB]
 * @property {number} [setsA]
 * @property {number} [setsB]
 * @property {boolean} [verified]
 * @property {string} [legacyStatus]
 * @property {string} [groupId]
 * @property {boolean} [canonicalSource]
 * @property {string} [validatedResultId]
 * @property {boolean} [differentialEligible]
 * @property {string} [core17ResultType]
 * @property {string} [core17Outcome]
 */

/**
 * @typedef {Object} StandingsRow
 * @property {string} entryId
 * @property {string} [teamId]
 * @property {string} [playerId]
 * @property {string} [name]
 * @property {number} played
 * @property {number} wins
 * @property {number} losses
 * @property {number} draws
 * @property {number} forfeits
 * @property {number} walkovers
 * @property {number} byes
 * @property {number} points
 * @property {number} gamesFor
 * @property {number} gamesAgainst
 * @property {number} gameDifference
 * @property {number} setsFor
 * @property {number} setsAgainst
 * @property {number} setDifference
 * @property {number} scoreFor
 * @property {number} scoreAgainst
 * @property {number} scoreDifference
 * @property {Record<string, unknown>} [headToHeadData]
 * @property {number} [seed]
 * @property {number} rank
 * @property {QualificationStatusValue} [qualificationStatus]
 * @property {string[]} [warnings]
 * @property {boolean} [manualOverrideApplied]
 */

/**
 * @typedef {Object} ManualStandingsOverride
 * @property {string} overrideId
 * @property {string} overrideType
 * @property {string} affectedEntryId
 * @property {number} [beforeRank]
 * @property {number} afterRank
 * @property {string} [reason]
 * @property {string} [actor]
 * @property {string} [timestamp]
 */

/**
 * @typedef {Object} QualificationRule
 * @property {number} [qualifiersCount]
 * @property {boolean} [requireGroupComplete]
 */

/**
 * @typedef {Object} StandingsConfiguration
 * @property {ScoringRule} scoringRule
 * @property {TieBreakRule[]} tieBreakRules
 * @property {string} [tieBreakRuleSetId]
 * @property {string} [tieBreakRuleSetVersion]
 * @property {QualificationRule} [qualificationRule]
 * @property {string} [drawLotSeed]
 */

/**
 * @typedef {Object} StandingsRequest
 * @property {string} [tournamentId]
 * @property {string} [eventId]
 * @property {string} [groupId]
 * @property {StandingsScopeValue} scope
 * @property {StandingsEntry[]} entries
 * @property {StandingsMatchRecord[]} matches
 * @property {StandingsConfiguration} configuration
 * @property {ManualStandingsOverride[]} [manualOverrides]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} StandingsExplanation
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} StandingsAudit
 * @property {string} engineVersion
 * @property {string} scoringRuleId
 * @property {string} scoringRuleVersion
 * @property {string} tieBreakRuleSetId
 * @property {string} tieBreakRuleSetVersion
 * @property {string[]} warnings
 * @property {string} [recordedAt]
 */

/**
 * @typedef {Object} StandingsSnapshot
 * @property {string} snapshotId
 * @property {string} [tournamentId]
 * @property {string} [eventId]
 * @property {string} [groupId]
 * @property {string} scoringRuleVersion
 * @property {string} tieBreakRuleVersion
 * @property {string} matchSetHash
 * @property {StandingsRow[]} rows
 * @property {string} generatedAt
 * @property {string} engineVersion
 * @property {string[]} warnings
 */

/**
 * @typedef {Object} StandingsDecisionTrace
 * @property {string} traceId
 * @property {string} engineVersion
 * @property {string} scoringRuleId
 * @property {string} scoringRuleVersion
 * @property {string} tieBreakRuleSetId
 * @property {string} tieBreakRuleSetVersion
 * @property {string} [tournamentId]
 * @property {string} [eventId]
 * @property {string} [groupId]
 * @property {string[]} inputMatchIds
 * @property {Array<{ matchId: string, reason: string }>} excludedMatches
 * @property {StandingsRow[]} initialRows
 * @property {Array<{ entryIds: string[] }>} tieGroups
 * @property {TieBreakStep[]} tieBreakSteps
 * @property {Array<Record<string, unknown>>} miniTableCalculations
 * @property {Array<Record<string, unknown>>} headToHeadCalculations
 * @property {string} [drawLotSeed]
 * @property {Record<string, string>} [drawLotTokens]
 * @property {Array<{ entryId: string, rank: number }>} finalRanks
 * @property {Array<Record<string, unknown>>} qualificationDecisions
 * @property {string[]} warnings
 * @property {string} timestamp
 */

/**
 * @typedef {Object} StandingsResult
 * @property {boolean} ok
 * @property {StandingsRow[]} rows
 * @property {StandingsSnapshot} snapshot
 * @property {StandingsDecisionTrace} decisionTrace
 * @property {StandingsAudit} audit
 * @property {StandingsExplanation[]} explanations
 * @property {string[]} warnings
 * @property {string[]} errors
 * @property {Array<{ code: string, message: string, details?: Record<string, unknown> }>} [typedErrors]
 * @property {Array<{ code: string, message: string, details?: Record<string, unknown> }>} [typedWarnings]
 * @property {{ applied: boolean, decisions: Array<Record<string, unknown>>, note?: string }} [legacyQualification]
 */

export {};
