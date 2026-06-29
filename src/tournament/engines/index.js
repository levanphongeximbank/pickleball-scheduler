export {
  validateEntryForEvent,
  validateNoDuplicatePlayersInEvent,
  validateGroupDrawInput,
  validateTournamentActivation,
} from "./validationEngine.js";

export {
  resolveWinnerFromScore,
  startMatch,
  assignMatchCourt,
  submitMatchScore,
  forfeitMatch,
  postponeMatch,
  clearMatchResult,
  createMatchBetweenEntries,
} from "./matchEngine.js";

export {
  DAILY_MATCH_TYPE,
  DAILY_GENDER_FILTER,
  getDefaultDailyPlaySettings,
  normalizeDailyPlaySettings,
  toggleDailyCheckIn,
  getBusyPlayerIdsFromDailyMatches,
  filterPlayersByGender,
  resolveDailyCompetitionType,
  getEligibleDailyPlayers,
  createFairDailyMatches,
  partitionDailyMatches,
  assignDailyMatchToCourt,
  submitDailyPlayMatchScore,
  toggleDailyCourtLock,
  releaseDailyCourt,
  buildDailyPlayTournamentPatch,
} from "./dailyPlayEngine.js";

export {
  buildCourtRuntimeState,
  buildCourtRuntimeStates,
  canAssignMatchToCourt,
  assignMatchToCourt,
  releaseCourt,
  setCourtLocked,
  getAvailableCourts,
  getBusyPlayerIds,
} from "./courtEngine.js";

export {
  filterPlayersForEventType,
  suggestTeamsFromPlayers,
  suggestEntriesFromPlayers,
  teamToEntry,
  entriesToTeams,
  calculateEntryRating,
  createMixedPairsFromPlayers,
  assignSeedsToEntries,
  createSingleEntriesFromPlayers,
  suggestBalancedEntriesFromIndividuals,
} from "./teamPairingEngine.js";

export {
  assignEntriesToGroupsSnake,
  summarizeGroupBalance,
} from "./seededGroupEngine.js";

export {
  buildRoundRobinMatchesForGroup,
  buildGroupStageSchedule,
  countGroupStageMatches,
} from "./scheduleEngine.js";

export {
  ensureInternalEvent,
  buildInternalTournamentPlan,
  applyInternalTournamentPlan,
  buildInternalTournamentPatch,
  getDefaultInternalEventType,
} from "./internalTournamentEngine.js";

export {
  buildGroupStandingFromMatches,
  buildAllGroupStandings,
} from "./rankingEngine.js";

export {
  canGenerateBracket,
  generateKnockoutBracket,
  resolveBracketProgress,
  setBracketWinner,
  submitKnockoutMatchScore,
  syncKnockoutMatchParticipants,
  toggleBracketRoundUnlock,
  resetBracketState,
  buildBracketPatch,
  getWinnersByMatchFromKnockoutMatches,
  mergeBracketWinners,
  isKnockoutRoundLocked,
  isGroupStageComplete,
  hasBracketGenerated,
  isBracketGenerationReady,
  autoSyncBracketFromGroupStandings,
} from "./bracketEngine.js";

export {
  assignEntriesOpenConditional,
  analyzeOpenDrawWarnings,
  getEntryClub,
  getEntryUnit,
  isHostEntry,
  isVisitorEntry,
} from "./openConditionalRandomEngine.js";

export {
  stripOpenEntryMetadata,
  createOpenEntryFromPlayer,
  createOpenEntryFromPair,
  ensureOfficialEvent,
  isSingleEventType,
  isDoubleEventType,
  validateOpenRegistrationPlayers,
  buildOfficialOpenPlan,
  applyOfficialOpenPlan,
  buildOfficialOpenPatch,
  createOfficialEventRecord,
  upsertOfficialEvent,
  removeOfficialEvent,
  buildOfficialAiBalancePlan,
  applyOfficialAiBalancePlan,
  buildOfficialAiBalancePatch,
} from "./officialTournamentEngine.js";

export {
  resolveEntryLabel,
  enrichMatchForDirector,
  partitionTournamentMatches,
  assignTournamentMatchToAvailableCourt,
  submitTournamentDirectorMatchScore,
  toggleTournamentDirectorCourtLock,
  buildEventDirectorSnapshot,
  buildDailyDirectorSnapshot,
  assignDailyDirectorMatch,
  submitDailyDirectorMatchScore,
  buildTournamentDirectorSnapshot,
} from "./tournamentDirectorEngine.js";

export {
  createEmptyPlayerHistoryStats,
  applyMatchRecordToStats,
  dailyMatchToRecord,
  eventMatchToRecord,
  collectMatchRecordsFromTournaments,
  mergeLegacyAiHistory,
  summarizePlayerHistoryStats,
  buildPlayerHistoryProfile,
  loadPlayerHistoryProfileForClub,
} from "./playerHistoryEngine.js";

export {
  createEmptyLeagueStandings,
  createEmptyPlayerSeasonStanding,
  applyMatchRecordToLeagueStandings,
  buildLeagueStandingsRows,
} from "./seasonStandingsEngine.js";

export {
  SEASON_EXPORT_SCHEMA_VERSION,
  summarizeTournamentForExport,
  summarizeRoundForExport,
  buildLeagueExportSection,
  buildSeasonExportPackage,
} from "./seasonExportEngine.js";

export {
  assignCourtRefereeToMatch,
  assignRefereeToMatch,
  buildMatchLiveRecord,
  buildRefereeSettingsPatch,
  buildRefereeShareText,
  buildRefereeUrl,
  buildWhatsAppRefereeUrl,
  copyRefereeShareText,
  getRefereeSettings,
  patchRefereeInTournament,
  resolveCourtRefereeForAssignment,
  resolveCourtRefereeName,
  resolveMatchLabels,
  setCourtRefereeAssignment,
} from "./refereeEngine.js";

export {
  appendScoreLogAfterDailySubmit,
  appendScoreLogAfterEventSubmit,
  buildDirectorScoreLogEntry,
  buildDisputeResetLogEntry,
  buildRefereeFinalizeLogEntry,
  formatScoreLogEntry,
  mergeLiveAuditIntoDailySettings,
  mergeLiveAuditIntoEvent,
  patchScoreLogInTournament,
  resolveDirectorScoreLogSource,
  summarizeCombinedAudit,
  summarizeScoreLog,
  SCORE_LOG_ACTION,
  SCORE_LOG_SOURCE,
} from "./scoreHistoryEngine.js";

export {
  isRefereeMatchLocked,
  REFEREE_MATCH_STATUS,
  resolveRefereeMatchStatus,
  resolveRefereeStatusColor,
  resolveRefereeStatusLabel,
} from "./refereeStatusEngine.js";

export {
  expectedScore,
  calculateEloDelta,
  buildEloUpdatesFromMatchRecord,
  applyEloUpdatesToPlayers,
} from "./eloEngine.js";

export {
  normalizeSkillLevelRules,
  getMonthKey,
  isMonthlyReviewDue,
  snapPublicLevel,
  computeNextPublicLevel,
  assessMonthlyPublicLevel,
  createSkillLevelProposal,
  normalizeSkillLevelProposal,
  normalizeSkillLevelProposals,
  buildSkillLevelProposalId,
  buildMonthlyHoldSkillMeta,
  buildApprovedSkillMeta,
  applyApprovedPublicLevel,
  applyMonthlyHoldReview,
  buildMonthlyPublicLevelUpdate,
  applyMonthlyPublicLevelUpdate,
  buildMonthlyPublicLevelUpdates,
  PROPOSAL_STATUS,
} from "./skillLevelEngine.js";
