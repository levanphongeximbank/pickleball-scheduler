/**
 * Shared repository contract types for team tournament data access.
 * @module teamTournamentRepositoryTypes
 */

/** @typedef {'blob'|'cloud'|'shadow'} RepositoryProvider */

/**
 * @template T
 * @typedef {object} RepositoryResult
 * @property {boolean} ok
 * @property {T} [data]
 * @property {string} [code]
 * @property {string} [error]
 * @property {number} [version]
 * @property {boolean} [replayed]
 * @property {Record<string, unknown>} [details]
 * @property {RepositoryProvider} [provider]
 */

/**
 * @typedef {object} TeamMemberRecord
 * @property {string} playerId
 * @property {string} [displayName]
 * @property {boolean} [isCaptain]
 * @property {boolean} [isDeputy]
 * @property {boolean} [isAbsent]
 */

/**
 * @typedef {object} TeamRecord
 * @property {string} id
 * @property {string} name
 * @property {string} [color]
 * @property {string} [logoUrl]
 * @property {string[]} playerIds
 * @property {string} [captainPlayerId]
 * @property {string[]} [deputyPlayerIds]
 * @property {number} [seed]
 */

/**
 * @typedef {object} SubMatchRecord
 * @property {string} id
 * @property {string} disciplineId
 * @property {string} status
 * @property {{ teamA: number, teamB: number, games?: object[] }} score
 * @property {string} [winnerTeamId]
 */

/**
 * @typedef {object} MatchupRecord
 * @property {string} id
 * @property {string} teamAId
 * @property {string} teamBId
 * @property {string} status
 * @property {SubMatchRecord[]} [subMatches]
 * @property {object} [result]
 * @property {string} [scheduledAt]
 */

/**
 * @typedef {object} LineupRecord
 * @property {string} matchupId
 * @property {string} teamId
 * @property {string} status
 * @property {Record<string, string[]>} selections
 * @property {number} [version]
 */

/**
 * @typedef {object} StandingRecord
 * @property {string} teamId
 * @property {number} rank
 * @property {number} wins
 * @property {number} losses
 * @property {number} points
 * @property {string} [teamName]
 */

/**
 * @typedef {object} ForfeitRecord
 * @property {string} matchupId
 * @property {string} [subMatchId]
 * @property {string} forfeitingTeamId
 * @property {string} scope
 * @property {string} resultType
 * @property {string} [reason]
 */

/**
 * @typedef {object} ScheduleRecord
 * @property {string} matchupId
 * @property {string} [scheduledAt]
 * @property {string} [courtLabel]
 * @property {number} [roundNumber]
 */

/**
 * @typedef {object} TournamentAggregate
 * @property {string} id
 * @property {string} clubId
 * @property {string} [tenantId]
 * @property {string} [mode]
 * @property {string} [status]
 * @property {number} [version]
 * @property {RepositoryProvider} [provider]
 * @property {TeamRecord[]} teams
 * @property {MatchupRecord[]} matchups
 * @property {Record<string, LineupRecord>} lineups
 * @property {StandingRecord[]} standings
 * @property {SubMatchRecord[]} subMatches
 * @property {ScheduleRecord[]} schedule
 * @property {object[]} disciplines
 * @property {object[]} groups
 * @property {object} settings
 * @property {object} [teamData]
 */

/**
 * Read-side options. viewerTeamId is blob-local only; cloud derives viewer from auth/session.
 * @typedef {object} ReadOptions
 * @property {string} [viewerTeamId]
 * @property {boolean} [includeSchedule]
 */

/**
 * @typedef {object} DraftCommandOptions
 * @property {number} expectedVersion
 * @property {string} idempotencyKey
 * @property {string} [reason]
 */

/**
 * @typedef {DraftCommandOptions} VersionedCommandOptions
 */

/**
 * @typedef {object} VisibleLineupsReadOptions
 * @property {string} matchupId
 * @property {string} [viewerTeamId]
 * @property {boolean} [includeSchedule]
 */

/**
 * @typedef {object} TournamentSubscriptionHandlers
 * @property {(event: { type: string, tournamentId: string, payload?: object }) => void} [onTournamentChange]
 * @property {(event: { type: string, matchupId: string, payload?: object }) => void} [onMatchupChange]
 * @property {(event: { type: string, lineupKey: string, payload?: object }) => void} [onLineupChange]
 * @property {(event: { type: string, payload?: object }) => void} [onStandingsChange]
 * @property {(error: { code: string, error: string }) => void} [onError]
 */

/**
 * @typedef {object} TournamentSubscriptionResult
 * @property {() => void} unsubscribe
 * @property {'polling'|'reload'} [fallbackMode]
 * @property {number} [pollingIntervalMs]
 */

export const REPOSITORY_ERROR_CODES = Object.freeze({
  MISSING_EXPECTED_VERSION: "MISSING_EXPECTED_VERSION",
  MISSING_IDEMPOTENCY_KEY: "MISSING_IDEMPOTENCY_KEY",
  INVALID_COMMAND_OPTIONS: "INVALID_COMMAND_OPTIONS",
  VIEWER_TEAM_ID_CLIENT_OVERRIDE_REJECTED: "VIEWER_TEAM_ID_CLIENT_OVERRIDE_REJECTED",
  NOT_FOUND: "REPOSITORY_NOT_FOUND",
  NOT_IMPLEMENTED: "REPOSITORY_NOT_IMPLEMENTED",
  REALTIME_NOT_IMPLEMENTED: "REPOSITORY_REALTIME_NOT_IMPLEMENTED",
  RPC_GUARD_NOT_DEPLOYED: "REPOSITORY_RPC_GUARD_NOT_DEPLOYED",
});

export const REPOSITORY_REALTIME_FALLBACK = Object.freeze({
  fallbackMode: "reload",
  pollingIntervalMs: 5000,
});
