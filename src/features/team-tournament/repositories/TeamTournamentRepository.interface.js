/**
 * Team Tournament Repository — data access boundary.
 * UI/engine must use factory.getRepository() — not clubStorage or Supabase directly.
 *
 * @typedef {import('./teamTournamentRepositoryTypes.js').RepositoryResult} RepositoryResult
 * @typedef {import('./teamTournamentRepositoryTypes.js').TournamentAggregate} TournamentAggregate
 * @typedef {import('./teamTournamentRepositoryTypes.js').TeamRecord} TeamRecord
 * @typedef {import('./teamTournamentRepositoryTypes.js').TeamMemberRecord} TeamMemberRecord
 * @typedef {import('./teamTournamentRepositoryTypes.js').MatchupRecord} MatchupRecord
 * @typedef {import('./teamTournamentRepositoryTypes.js').LineupRecord} LineupRecord
 * @typedef {import('./teamTournamentRepositoryTypes.js').SubMatchRecord} SubMatchRecord
 * @typedef {import('./teamTournamentRepositoryTypes.js').StandingRecord} StandingRecord
 * @typedef {import('./teamTournamentRepositoryTypes.js').ForfeitRecord} ForfeitRecord
 * @typedef {import('./teamTournamentRepositoryTypes.js').ScheduleRecord} ScheduleRecord
 * @typedef {import('./teamTournamentRepositoryTypes.js').ReadOptions} ReadOptions
 * @typedef {import('./teamTournamentRepositoryTypes.js').DraftCommandOptions} DraftCommandOptions
 * @typedef {import('./teamTournamentRepositoryTypes.js').VersionedCommandOptions} VersionedCommandOptions
 * @typedef {import('./teamTournamentRepositoryTypes.js').VisibleLineupsReadOptions} VisibleLineupsReadOptions
 * @typedef {import('./teamTournamentRepositoryTypes.js').TournamentSubscriptionHandlers} TournamentSubscriptionHandlers
 * @typedef {import('./teamTournamentRepositoryTypes.js').TournamentSubscriptionResult} TournamentSubscriptionResult
 *
 * @typedef {object} SaveDraftLineupPayload
 * @property {string} matchupId
 * @property {string} teamId
 * @property {Record<string, string[]>} selections
 *
 * @typedef {object} SubmitLineupPayload
 * @property {string} matchupId
 * @property {string} teamId
 * @property {Record<string, string[]>} selections
 *
 * @typedef {object} MatchupCommandPayload
 * @property {string} matchupId
 *
 * @typedef {object} RandomizeLineupPayload
 * @property {string} matchupId
 * @property {string} teamId
 *
 * @typedef {object} ConfirmSubMatchPayload
 * @property {string} matchupId
 * @property {string} subMatchId
 * @property {object} score
 * @property {string} [winnerTeamId]
 *
 * @typedef {object} ApplyForfeitPayload
 * @property {string} matchupId
 * @property {string} [subMatchId]
 * @property {string} [forfeitingTeamId]
 * @property {string} [scope]
 * @property {string} [resultType]
 * @property {string} [reason]
 * @property {object} [technicalScore]
 *
 * @typedef {object} RecalculateStandingsData
 * @property {StandingRecord[]} standings
 * @property {string} calculationVersion
 *
 * @typedef {object} TeamTournamentRepository
 * @property {() => import('./teamTournamentRepositoryTypes.js').RepositoryProvider} getProvider
 * @property {(clubId: string, tournamentId: string, options?: ReadOptions) => Promise<RepositoryResult<TournamentAggregate>>} getTournament
 * @property {(clubId: string, tournamentId: string, options?: ReadOptions) => Promise<RepositoryResult<TeamRecord[]>>} listTeams
 * @property {(clubId: string, tournamentId: string, options?: ReadOptions) => Promise<RepositoryResult<MatchupRecord[]>>} getMatchups
 * @property {(clubId: string, tournamentId: string, options: VisibleLineupsReadOptions) => Promise<RepositoryResult<object>>} getVisibleLineups
 * @property {(clubId: string, tournamentId: string, payload: SaveDraftLineupPayload, commandOptions: DraftCommandOptions) => Promise<RepositoryResult<object>>} saveDraftLineup
 * @property {(clubId: string, tournamentId: string, payload: SubmitLineupPayload, commandOptions: VersionedCommandOptions) => Promise<RepositoryResult<object>>} submitLineup
 * @property {(clubId: string, tournamentId: string, payload: MatchupCommandPayload, commandOptions: VersionedCommandOptions) => Promise<RepositoryResult<object>>} lockLineup
 * @property {(clubId: string, tournamentId: string, payload: MatchupCommandPayload, commandOptions: VersionedCommandOptions) => Promise<RepositoryResult<object>>} publishLineups
 * @property {(clubId: string, tournamentId: string, payload: RandomizeLineupPayload, commandOptions: VersionedCommandOptions) => Promise<RepositoryResult<object>>} randomizeLineup
 * @property {(clubId: string, tournamentId: string, payload: ConfirmSubMatchPayload, commandOptions: VersionedCommandOptions) => Promise<RepositoryResult<object>>} confirmSubMatchResult
 * @property {(clubId: string, tournamentId: string, payload: ApplyForfeitPayload, commandOptions: VersionedCommandOptions) => Promise<RepositoryResult<object>>} applyForfeit
 * @property {(clubId: string, tournamentId: string, payload: MatchupCommandPayload, commandOptions: VersionedCommandOptions) => Promise<RepositoryResult<object>>} completeMatchup
 * @property {(clubId: string, tournamentId: string, options?: ReadOptions) => Promise<RepositoryResult<StandingRecord[]>>} getStandings
 * @property {(clubId: string, tournamentId: string, commandOptions: VersionedCommandOptions) => Promise<RepositoryResult<RecalculateStandingsData>>} recalculateStandings
 * @property {(clubId: string, tournamentId: string, handlers: TournamentSubscriptionHandlers) => Promise<RepositoryResult<TournamentSubscriptionResult>>} subscribeTournament
 */

export {
  REPOSITORY_ERROR_CODES,
  REPOSITORY_REALTIME_FALLBACK,
} from "./teamTournamentRepositoryTypes.js";

export {
  notImplementedRepositoryResult as notImplemented,
  notImplementedSubscriptionResult,
  normalizeRepositoryResult,
  rejectClientViewerTeamIdForCloud,
  repositoryFailure,
  repositorySuccess,
  validateVersionedCommandOptions,
  validatePublishCommandOptions,
  validateOverrideCommandOptions,
} from "./teamTournamentRepositoryValidation.js";

export {
  extractScheduleFromMatchups,
  extractSubMatchesFromMatchups,
  listAggregateCollectionKeys,
  mapTournamentToAggregate,
} from "./teamTournamentRepositoryAggregate.js";
