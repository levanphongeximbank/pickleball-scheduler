/**
 * Canonical Tournament feature module.
 * Director Mode remains under ./director; this index is the organizer runtime boundary.
 */

export {
  listTournamentsQuery,
  listMyTournamentsQuery,
  getTournamentQuery,
  listOpenTournamentsQuery,
  buildTournamentHubStats,
} from "./services/tournamentQueries.js";

export {
  createTournamentCommand,
  updateTournamentCommand,
  deleteTournamentCommand,
  applyEngineV4StateCommand,
} from "./services/tournamentCommands.js";

export {
  getTournamentRepository,
  createTournamentRepository,
  resolveTournamentDataMode,
  TOURNAMENT_DATA_MODES,
  requireExplicitTenantForClub,
} from "./services/tournamentApplicationService.js";

export { CANONICAL_TOURNAMENT_HUB_ITEMS } from "./constants/hubNav.js";
export { MODE_LABELS_VI, STATUS_LABELS_VI, modeLabelVi, statusLabelVi } from "./constants/tournamentLabels.js";
export { CANONICAL_TOURNAMENT_RPC } from "./repositories/canonicalTournamentRpcs.js";
