/**
 * Application-facing Tournament service (queries + commands facade).
 */
export {
  listTournamentsQuery,
  listMyTournamentsQuery,
  getTournamentQuery,
  listOpenTournamentsQuery,
  buildTournamentHubStats,
} from "./tournamentQueries.js";

export {
  createTournamentCommand,
  updateTournamentCommand,
  deleteTournamentCommand,
  applyEngineV4StateCommand,
} from "./tournamentCommands.js";

export { getTournamentRepository, createTournamentRepository } from "../repositories/tournamentRepositoryFactory.js";
export { resolveTournamentDataMode, TOURNAMENT_DATA_MODES } from "../repositories/tournamentDataMode.js";
export { requireExplicitTenantForClub } from "../repositories/transitionalBlobTournamentRepository.js";
