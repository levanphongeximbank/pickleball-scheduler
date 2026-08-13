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
  uniqueOfficialIndividualSelection,
  toggleOfficialIndividualSelection,
  mergeVisibleOfficialIndividualSelection,
  formatOfficialBulkRegistrationError,
  registerOfficialIndividualsBatch,
} from "./engines/officialRegistrationBatchEngine.js";

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
  OFFICIAL_STAGE_ID,
  OFFICIAL_STAGE_STATE,
  OFFICIAL_STAGE_DEFS,
  summarizeOfficialEntries,
  projectOfficialFinalizationBuckets,
  summarizeOfficialMatches,
  summarizeOfficialRefereeOps,
  buildOfficialCompetitionFacts,
  deriveOfficialOrganizerStages,
  deriveOfficialNextAction,
  evaluateOfficialCloseGate,
  filterOfficialDrawEntries,
  buildOfficialDrawBlockMessage,
  deriveOfficialKnockoutStages,
} from "./engines/officialOrganizerWorkflowEngine.js";

export {
  projectOfficialDrawSubsteps,
  formOfficialIndividualPairs,
  assertOfficialGroupDrawAllowed,
  getOfficialGroupDrawUnits,
  preserveOfficialRegistrationOnGroupDrawEvent,
  applyOfficialGroupDrawPreservingRegistration,
  listOfficialRegistrationEntries,
  listOfficialDrawEntries,
  isOfficialPairShapedEntry,
  isOfficialIndividualShapedEntry,
  OFFICIAL_DRAW_PAIR_ORIGIN,
  OFFICIAL_REGISTRATION_LOCAL_SELECTION,
  OFFICIAL_REGISTRATION_FORBIDDEN_LABELS,
} from "./engines/officialDrawOrchestrationEngine.js";

export {
  projectOfficialGroupDrawReview,
  presentOfficialGroupLabel,
  isRawTechnicalId,
  GROUP_MATCH_COUNT_SOURCE,
  GROUP_REVIEW_ISSUE,
} from "./engines/officialGroupDrawReviewProjection.js";

export {
  REFEREE_IDENTITY_BINDING_BLOCKED,
  REFEREE_SCORING_RULE_TRANSPORT_BLOCKED,
  syncOfficialAssignedMatchToLive,
  syncOfficialRefereeAssignResultToLive,
} from "./engines/officialRefereeLiveBridge.js";

export {
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_REGISTRATION_MODE_RESOLUTION,
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_ROUND_SCORE_KEY,
  DEFAULT_OFFICIAL_ROUND_TARGETS,
  CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
  SIDEOUT_OPERATIONAL,
  SIDEOUT_SELECTION_FAIL_CLOSED,
  SIDEOUT_BACKEND_REQUIREMENT,
  SIDEOUT_BACKEND_PACKAGE_REQUIRED,
  SIDEOUT_BACKEND_PACKAGE_PATH,
  SIDEOUT_DEFAULT_FOR_NEW_TOURNAMENT,
  SIDEOUT_SHARED_EXTRACTION_RECONCILE_AFTER_PR418,
  INTENDED_NEW_TOURNAMENT_SCORING_METHOD,
  WIN_BY_POLICY_DEFERRED,
  OFFICIAL_WIN_BY_DUPLICATE_AUTHORITY,
  parseOfficialDecimalLevelInput,
  assessOfficialRegistrationModeChange,
  resolveNewOfficialTournamentScoringDefault,
  getOfficialCompetitionSettings,
  patchOfficialCompetitionSettings,
  resolveOfficialRegistrationMode,
  deriveLegacyOfficialRegistrationMode,
  normalizeOfficialRegistrationMode,
  normalizeOfficialScoringMethod,
  normalizeOfficialRoundTargets,
  isOfficialRegistrationModeResolved,
  isOfficialPairRegistrationMode,
  isOfficialIndividualRegistrationMode,
  OFFICIAL_REGISTRATION_MODE_LABELS,
  OFFICIAL_SCORING_METHOD_LABELS,
  OFFICIAL_ROUND_SCORE_LABELS,
} from "./engines/officialTournamentSettingsEngine.js";

export {
  SIDEOUT_POINT_BY_POINT_RUNTIME_BLOCKED,
  mapMatchToOfficialRoundKey,
  resolveOfficialMatchScoringRules,
  validateOfficialFinishedScore,
} from "./engines/officialScoringRulesResolver.js";

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
