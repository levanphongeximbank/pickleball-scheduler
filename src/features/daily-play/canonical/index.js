export {
  DAILY_PLAY_RPC,
  DAILY_PLAY_CODE,
  DAILY_PLAY_MESSAGES,
  DAILY_PLAY_ACTIVE_MATCH_STATUSES,
  DAILY_PLAY_OPERATIONAL_WRITE_RPCS,
} from "./dailyPlayCodes.js";

export {
  DAILY_PLAY_GENERIC_ACTION_ERROR,
  normalizeDailyPlayMutationResult,
  resolveSessionErrorAfterSnapshot,
  shouldClearSessionErrorAfterSnapshot,
} from "./dailyPlayMutationError.js";

export {
  DAILY_MATCH_TYPE as CANONICAL_DAILY_MATCH_TYPE,
  DAILY_MATCH_TYPE_LABELS,
  DAILY_MATCH_TYPE_OPTIONS,
  CANONICAL_PERSISTED_DAILY_MATCH_TYPES,
  getDailyMatchShape,
  getDailyMatchShapeForMatch,
  normalizeDailyMatchType,
  resolveCanonicalPersistedMatchType,
  resolveCanonicalPersistedMatchTypeFromMatch,
} from "./dailyPlayMatchShape.js";

export {
  emptyDailyPlayState,
  normalizeDailyPlayCanonicalState,
  normalizeCanonicalCourt,
  selectEnabledCourts,
  getBusyPlayerIds,
  listAvailableCourts,
  resolveCreateMatchCount,
  isNoCourtWaitingCopy,
  shouldShowNoCourtWaitingWarning,
  isObsoleteNoCourtAvailabilityError,
  resolveCreateCourtWaitingNote,
  resolveAssignCourtId,
  validateScoreInput,
  acceptDailyScoreFieldInput,
  parseNonNegativeIntegerScore,
  applyCorrectScore,
  applyCloseSession,
  classifyDailyCloseReadiness,
  assertDailyTournamentClosable,
  formatSessionCloseBlockedMessage,
  formatSessionCloseConfirmMessage,
  isDailySessionCompleted,
  validateDailyMatchGenderComposition,
  buildCourtRuntimeView,
  dailyPlayCourtRuntimeLabel,
  sanitizeOccupiedCourtIds,
  resolveOccupiedCourtIds,
  assertExpectedVersion,
  validateDoublesMatchShape,
  validateDailyMatchShape,
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

export {
  resolveDailyVisibleGenderScope,
  filterPlayersForDailyMatchType,
  projectDailyPlayerFilterView,
  countVisiblePresentedChecked,
  listVisibleBulkCheckInTargets,
  listVisibleBulkCheckOutTargets,
} from "./projectDailyPlayerFilterView.js";

// Hook lives in useDailyPlayCanonicalSession.js — import directly from UI
// to keep non-React unit tests free of the react package graph.
