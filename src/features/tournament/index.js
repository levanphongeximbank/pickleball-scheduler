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
  setTournamentCourtScheduleCommand,
} from "./services/tournamentCommands.js";
export {
  reserveOfficialTournamentCourtsCommand,
  commitOfficialGroupScheduleCommand,
} from "./court-reservation/officialCourtReservationCommands.js";
export { createInMemoryOfficialCourtAuthority } from "./court-reservation/inMemoryOfficialCourtAuthority.js";
export {
  __setOfficialCourtReservationRpcForTests,
  __resetOfficialCourtReservationRpcForTests,
} from "./court-reservation/officialCourtReservationService.js";
export {
  OFFICIAL_COURT_RPC,
  OFFICIAL_COURT_CODE,
} from "./court-reservation/officialCourtReservationCodes.js";

export {
  findMatchInCanonicalTournament,
  processCanonicalCompletedMatch,
} from "./services/tournamentMatchLifecycle.js";

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
export { resolveTournamentCourtInventoryScope } from "./guards/tournamentCourtInventoryScope.js";
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
  resolveCanonicalTournamentLoadPolicy,
} from "./hooks/useCanonicalTournament.js";
export { createInMemoryCanonicalTournamentRpc } from "./repositories/inMemoryCanonicalTournamentRpc.js";
export {
  canonicalRowToTournament,
  tournamentToCanonicalRow,
  tournamentMatchesMine,
} from "./mappers/canonicalTournamentMapper.js";
