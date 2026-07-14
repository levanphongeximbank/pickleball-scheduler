export {
  REGISTRATION_AUDIT_ACTIONS,
  normalizeRegistrationSettings,
  getRegistrationSettings,
  isRegistrationLocked,
  isWithinRegistrationWindow,
  canSubmitRegistration,
  countApprovedEntries,
  countActiveRegistrations,
  listWaitlistedEntries,
  setRegistrationWindow,
  lockRegistration,
  autoCloseRegistrationIfExpired,
  submitRegistration,
  approveEntry,
  rejectEntry,
  waitlistEntry,
  promoteFromWaitlist,
  cancelRegistration,
  confirmPartnerInvite,
  changePartner,
  listEntriesByStatus,
  getPlayerRegistrationStatus,
  resolveEventTypeFromQuery,
  isDrawEligibleEntry,
  isCountableRegistrationEntry,
  ENTRY_STATUS,
} from "./engines/registrationEngine.js";

export {
  ELIGIBILITY_VIOLATION,
  DEFAULT_ELIGIBILITY_RULES,
  normalizeEligibilityRules,
  getEligibilityRules,
  updateEligibilityRules,
  getPlayerAge,
  getPlayerDisplayRating,
  checkPlayerEligibility,
  checkEntryPlayersEligibility,
  checkAllEntriesEligibility,
  findCrossEventDuplicates,
  auditEligibilityDecision,
} from "./engines/eligibilityEngine.js";

export {
  PAYMENT_STATUS,
  FEE_MODE,
  DEFAULT_ENTRY_FEE,
  normalizeEntryFee,
  getEntryFee,
  setEntryFee,
  resolveFeeAmount,
  getEntryPayment,
  isEntryFeeSatisfied,
  canApproveWithFee,
  recordEntryPayment,
  organizerOverridePayment,
  getEntryFeeSummary,
} from "./engines/entryFeeEngine.js";

export {
  getRegulations,
  setRegulations,
  getRegistrationPolicy,
  setRegistrationPolicy,
  REGULATION_TEMPLATES,
  DEFAULT_REGULATIONS,
  DEFAULT_REGISTRATION_POLICY,
} from "./engines/regulationsEngine.js";

export {
  validateRegistrationEligibility,
  gatedSubmitRegistration,
  gatedConfirmPartnerInvite,
  gatedApproveEntry,
  gatedPromoteFromWaitlist,
} from "./engines/registrationValidation.js";

export {
  SEED_RATING_SOURCE,
  getPlayerReliabilityScore,
  resolveMemberSeedRating,
  resolveEntrySeedRating,
  enrichParticipantWithRatingV5,
  displayRatingToSeedSkill,
  attachSeedBands,
  verifySeedIntegrity,
  applyManualSeedOverride,
  appendSeedAudit,
} from "./adapters/ratingV5SeedAdapter.js";

export {
  buildIndividualGroupStanding,
  buildIndividualAllGroupStandings,
  preparePostTournamentRatingHooks,
} from "./adapters/individualStandingsAdapter.js";

export {
  findMinimumRestViolations,
  warnIfRestViolated,
  validateScheduleConflicts,
  hasHardScheduleConflicts,
  findCourtConflicts,
} from "./engines/restTimeEngine.js";

export {
  REFEREE_ASSIGN_STATUS,
  REFEREE_ASSIGN_AUDIT,
  getRefereeAssignments,
  listIndividualReferees,
  addIndividualReferee,
  collectEventMatches,
  validateRefereeAvailability,
  detectRefereeConflicts,
  assignRefereeToIndividualMatch,
  reassignReferee,
  unassignRefereeFromMatch,
  autoAssignReferees,
  assertAssignmentScope,
  listMatchesForReferee,
  buildIndividualRefereeAssignmentTable,
  getAssignAuditLog,
} from "./engines/refereeAssignEngine.js";

export {
  MATCH_RESULT_TYPE,
  MATCH_RESULT_STATUS,
  RESULT_AUDIT_ACTIONS,
  getMatchResults,
  getMatchResult,
  isMatchResultLocked,
  isThirdPlaceMatch,
  startIndividualMatch,
  submitMatchResult,
  confirmMatchResult,
  finalizeMatchResult,
  unlockMatchResultForCorrection,
  isCommandProcessed,
  getResultPropagationState,
} from "./engines/matchResultEngine.js";

export {
  propagateMatchResult,
  recalculateDownstream,
  getLiveStandings,
  listCompletedLockedMatches,
} from "./engines/resultPropagationEngine.js";

export {
  CORRECTION_STATUS,
  listResultCorrections,
  requestResultCorrection,
  approveResultCorrection,
  rejectResultCorrection,
} from "./engines/resultCorrectionEngine.js";

export {
  WALKOVER_REASON,
  RESULTS_OPS_AUDIT,
  getResultsOps,
  declareWalkover,
  listWalkovers,
  appendResultsOpsAudit,
} from "./engines/walkoverEngine.js";

export {
  WITHDRAWAL_STATUS,
  WITHDRAWAL_PHASE,
  isEntryWithdrawn,
  listPendingWithdrawals,
  listWithdrawalHistory,
  requestWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  filterDrawEligibleEntries,
} from "./engines/withdrawalEngine.js";

export {
  isThirdPlaceEnabled,
  setThirdPlaceEnabled,
  ensureThirdPlaceMatch,
  syncThirdPlaceParticipants,
  generateThirdPlaceForTournament,
  getThirdPlaceMedalEntryId,
} from "./engines/thirdPlaceEngine.js";

export {
  AWARD_KEY,
  DEFAULT_AWARDS_CONFIG,
  getAwardsConfig,
  getAwardsState,
  updateAwardsConfig,
  buildFinalRanking,
  buildAwardsPreview,
  assignAward,
  autoAssignAwardsFromRanking,
  exportAwardsJson,
  exportAwardsCsv,
  getPlayerAwardSummary,
} from "./engines/awardsEngine.js";

export {
  canCloseTournament,
  closeTournament,
  isTournamentClosed,
  getFrozenStandings,
  getTournamentSummary,
  buildTournamentSummary,
  reopenClosedTournament,
} from "./engines/tournamentClosingEngine.js";

export {
  findPlayerEntries,
  listUpcomingMatchesForEntry,
  listMatchHistoryForEntry,
  resolvePlayerStanding,
  buildScheduleViewForEntry,
  buildBracketViewSummary,
  buildPlayerPortalDashboard,
  listPlayerTournaments,
} from "./engines/playerPortalEngine.js";

export {
  PLAYER_NOTIFICATION_TYPE,
  buildPlayerNotifications,
  markNotificationsRead,
  markAllNotificationsRead,
  dismissNotification,
  bumpPortalOptimisticVersion,
  getPortalOptimisticVersion,
} from "./engines/playerNotificationEngine.js";
