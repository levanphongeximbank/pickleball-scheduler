export {
  DAILY_PLAY_RPC,
  DAILY_PLAY_CODE,
  DAILY_PLAY_MESSAGES,
  DAILY_PLAY_ACTIVE_MATCH_STATUSES,
} from "./dailyPlayCodes.js";

export {
  DAILY_PLAY_GENERIC_ACTION_ERROR,
  normalizeDailyPlayMutationResult,
  resolveSessionErrorAfterSnapshot,
  shouldClearSessionErrorAfterSnapshot,
} from "./dailyPlayMutationError.js";

export {
  emptyDailyPlayState,
  normalizeDailyPlayCanonicalState,
  normalizeCanonicalCourt,
  selectEnabledCourts,
  getBusyPlayerIds,
  listAvailableCourts,
  resolveCreateMatchCount,
  validateScoreInput,
  acceptDailyScoreFieldInput,
  parseNonNegativeIntegerScore,
  applyCorrectScore,
  buildCourtRuntimeView,
  assertExpectedVersion,
  validateDoublesMatchShape,
  assertMatchParticipantsReady,
  applyStartMatch,
} from "./dailyPlayCanonicalDomain.js";

export {
  createInMemoryDailyPlayAuthority,
  createSeededDailyPlayTournament,
} from "./inMemoryDailyPlayAuthority.js";

export {
  createDailyPlayCanonicalService,
  getDailyPlayCanonicalService,
  __setDailyPlayCanonicalServiceForTests,
  __resetDailyPlayCanonicalServiceForTests,
} from "./dailyPlayCanonicalService.js";

export {
  normalizeDailyPlayServerSnapshot,
  isFullDailyPlaySnapshot,
} from "./normalizeDailyPlayServerSnapshot.js";

export {
  DAILY_PLAY_REFRESH_REASON,
  buildCanonicalSnapshotSignature,
  createDailyPlayRefreshFence,
  isDocumentHidden,
  isSilentRefreshReason,
  shouldReplaceCanonicalSnapshot,
  shouldSkipRoutinePoll,
} from "./dailyPlaySessionRefresh.js";

export {
  resolvePresentedCheckedSet,
  beginPresenceOverride,
  shouldIgnoreConcurrentPresenceClick,
  reconcilePresenceOverride,
  rollbackPresenceOverride,
  isPresenceOverrideAuthoritative,
} from "./presencePresentation.js";

// Hook lives in useDailyPlayCanonicalSession.js — import directly from UI
// to keep non-React unit tests free of the react package graph.
