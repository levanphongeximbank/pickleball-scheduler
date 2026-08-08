/**
 * Canonical Tournament feature module — CLOUD ONLY organizer authority.
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
  setTournamentStatusCommand,
} from "./services/tournamentCommands.js";

export {
  getTournamentRepository,
  createTournamentRepository,
  resolveTournamentDataMode,
  TOURNAMENT_DATA_MODES,
  __resetTournamentRepositorySingleton,
  __setTournamentRepositoryRpcForTests,
} from "./repositories/tournamentRepositoryFactory.js";

export {
  requireExplicitTenantForClub,
  requireExplicitTournamentTenant,
  requireClubId,
  resolveExplicitTenantFromClub,
  resolveTournamentTenantScope,
  buildTournamentClubScope,
} from "./guards/tournamentTenant.js";
export { assertLoadedTournamentAccess } from "./guards/tournamentAccess.js";
export { CANONICAL_TOURNAMENT_HUB_ITEMS } from "./constants/hubNav.js";
export {
  MODE_LABELS_VI,
  STATUS_LABELS_VI,
  modeLabelVi,
  statusLabelVi,
} from "./constants/tournamentLabels.js";
export { CANONICAL_TOURNAMENT_RPC } from "./repositories/canonicalTournamentRpcs.js";
export {
  useCanonicalTournament,
  useCanonicalTournamentList,
  useCanonicalMyTournaments,
} from "./hooks/useCanonicalTournament.js";
export { createInMemoryCanonicalTournamentRpc } from "./repositories/inMemoryCanonicalTournamentRpc.js";
export {
  canonicalRowToTournament,
  tournamentToCanonicalRow,
  tournamentMatchesMine,
} from "./mappers/canonicalTournamentMapper.js";
