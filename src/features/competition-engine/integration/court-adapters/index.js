/**
 * Competition Mode Court Adapter B — public exports.
 *
 * Owner: 2.13 Competition Engine
 * Head A: Competition Court Adapter Contract (frozen V1)
 * Court provider binding: courtResourceCompetitionAdapter (2.2 Court Operations)
 */
export {
  CANONICAL_COMPETITION_COURT_ADAPTERS_DEFAULT,
  CANONICAL_COMPETITION_COURT_ADAPTERS_FLAG,
  isCanonicalCompetitionCourtAdaptersEnabled,
  __setCanonicalCompetitionCourtAdaptersForTests,
  __resetCanonicalCompetitionCourtAdaptersForTests,
} from "./canonicalCompetitionCourtAdapters.js";

export {
  MODE_COURT_ADAPTER_B_OWNER,
  MODE_COURT_ADAPTER_B_CODE,
  createModeCourtAdapterB,
  normalizeModePhysicalCourtIds,
  normalizeModeCourtScope,
} from "./createModeCourtAdapterB.js";

export {
  createDailyPlayCourtAdapter,
  dailyPlayCourtAdapter,
  DAILY_PLAY_MODE_KEY,
  DAILY_PLAY_COMPETITION_TYPE,
} from "./DailyPlayCourtAdapter.js";

export {
  createInternalTournamentCourtAdapter,
  internalTournamentCourtAdapter,
  INTERNAL_TOURNAMENT_MODE_KEY,
} from "./InternalTournamentCourtAdapter.js";

export {
  createOfficialTournamentCourtAdapter,
  officialTournamentCourtAdapter,
  OFFICIAL_TOURNAMENT_MODE_KEY,
} from "./OfficialTournamentCourtAdapter.js";

export {
  createTeamTournamentCourtAdapter,
  teamTournamentCourtAdapter,
  TEAM_TOURNAMENT_MODE_KEY,
} from "./TeamTournamentCourtAdapter.js";

export {
  resolveCompetitionTypeForMode,
  createModeCourtAdapterForCompetition,
} from "./resolveModeCourtAdapter.js";

export {
  syncCompetitionCourtScheduleViaAdapterB,
  releaseCompetitionCourtScheduleViaAdapterB,
  listCompetitionEligibleCourtsViaAdapterB,
} from "./competitionCourtScheduleBridge.js";

export {
  DAILY_PLAY_LEASE_IS_CAPACITY_SSOT,
  DAILY_PLAY_LEASE_IS_PROJECTION,
  DAILY_PLAY_CAPACITY_AUTHORITY,
  createDailyPlayLeaseProjectionStore,
  defaultDailyPlayLeaseProjectionStore,
} from "./dailyPlayLeaseProjection.js";

export {
  createDailyPlayCourtOrchestrator,
  createIsolatedDailyPlayCourtOrchestrator,
} from "./dailyPlayCourtOrchestrator.js";
