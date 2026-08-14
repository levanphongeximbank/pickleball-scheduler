/**
 * Internal Tournament module barrel — lifecycle / CAS / hydration / one-group.
 */
export {
  CANONICAL_TOURNAMENT_VERSION_CONFLICT,
  CANONICAL_TOURNAMENT_VERSION_REQUIRED,
  CANONICAL_VERSION_CONFLICT_USER_MESSAGE,
  CANONICAL_VERSION_REQUIRED_USER_MESSAGE,
  INTERNAL_VERSION_SYNCING_USER_MESSAGE,
  resolveCanonicalExpectedVersion,
  assertInternalExpectedVersion,
  assertInternalTournamentReadyForMutation,
  isCanonicalVersionConflict,
  isCanonicalVersionRequired,
  formatCanonicalVersionConflictError,
  chainExpectedVersionFromResult,
} from "./canonicalTournamentCas.js";

export {
  INTERNAL_STATUS_TRANSITION_ERROR,
  INTERNAL_TOURNAMENT_STATUS_TRANSITIONS,
  normalizeInternalStatus,
  validateInternalTournamentStatusTransition,
  resolveStatusAfterMatchActivity,
} from "./internalTournamentStatusTransitions.js";

export {
  INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE,
  isInternalMatchGenuinelyTerminal,
  isInternalFinalMatch,
  assertInternalCompetitionComplete,
  assertInternalCloseSnapshot,
  assertInternalTournamentCompletionEligibility,
  assertInternalStatusCompletionGate,
  classifyInternalMatchCompletionShape,
} from "./internalTournamentCompletionEligibility.js";

export {
  hydrateInternalSetupFromTournament,
  nextHydrationGeneration,
} from "./internalTournamentSetupHydration.js";

export {
  INTERNAL_HYDRATION_ACTION,
  computeInternalSetupDirtyFlags,
  isInternalSetupFormDirty,
  decideInternalSetupHydration,
  advanceHydrationBaselineAfterOwnWrite,
} from "./internalTournamentDirtyHydration.js";

export {
  ONE_GROUP_COMPLETION_MESSAGE,
  getInternalEventGroupCount,
  isOneGroupInternalEvent,
  shouldSkipKnockoutForInternal,
  resolveInternalKnockoutEligibility,
  listGroupStageMatches,
  canFinishOneGroupInternal,
  resolveOneGroupChampionProjection,
  canCloseOneGroupInternal,
  assertNoKnockoutMatchesForOneGroup,
} from "./internalTournamentOneGroupCompletion.js";

export {
  INTERNAL_GROUP_STANDINGS_ENGINE,
  INTERNAL_GROUP_TIE_BREAK_RULE,
  INTERNAL_KNOCKOUT_INCOMPLETE_MESSAGE,
  isInternalGroupStandingsVisible,
  isInternalGroupStandingsFinal,
  resolveInternalKnockoutAction,
  projectInternalLiveGroupStandings,
  standingsFingerprint,
} from "./internalGroupStandings.js";

export {
  INTERNAL_LIFECYCLE_STEPS,
  INTERNAL_LIFECYCLE_LABELS,
  resolveInternalTournamentLifecycle,
} from "./internalTournamentLifecycleResolver.js";

export {
  INTERNAL_WORKSPACE_SECTIONS,
  INTERNAL_WORKSPACE_SECTION_LABELS,
  mapLifecycleStepToWorkspaceSection,
  INTERNAL_WORKSPACE_SECTION_QUERY,
  parseInternalWorkspaceSection,
  isInternalBracketDefaultAllowed,
  resolveLifecycleDefaultWorkspaceSection,
  isInternalWorkspaceSectionAvailable,
  resolveInternalWorkspaceSection,
  resolveInternalWorkspaceKey,
  resolveCanonicalLoadPresentation,
  resolveCanonicalScopeGapPolicy,
  resolveCanonicalIdentityChangePolicy,
  resolveInternalPageLoadingGate,
  resolveTournamentManageGatePresentation,
} from "./internalWorkspaceSections.js";

export {
  INTERNAL_NO_REFEREE_ROSTER_MESSAGE,
  listEligibleInternalReferees,
  assignInternalMatchReferee,
  summarizeInternalRefereeCoverage,
  listInternalMatchesForRefereeBoard,
  formatInternalMatchRefereeLabel,
} from "./internalMatchRefereeAssignment.js";

export {
  INTERNAL_OPTIONAL_ELO_SEASON_NOTICE,
  classifyCanonicalMatchLifecycleResult,
} from "./internalMatchLifecyclePresentation.js";

export { resolveInternalSchedulePrerequisite } from "./internalSchedulePrerequisite.js";

export {
  INTERNAL_COURT_AUTHORITY,
  INTERNAL_COURT_READER,
  INTERNAL_COURT_AVAILABILITY,
  INTERNAL_COURT_COPY,
  projectInternalScheduleCourts,
  listInternalAvailableScheduleCourts,
  classifyInternalCourtAvailability,
  assignCourtsAndTimesToExistingInternalMatches,
  loadInternalScheduleCourts,
  matchesHaveCourtAndTime,
} from "./internalScheduleCourts.js";

export {
  INTERNAL_SCHEDULE_ACTIONS,
  resolveInternalScheduleLifecycle,
  lockInternalSchedule,
  publishInternalSchedule,
} from "./internalScheduleLifecycle.js";

export {
  INTERNAL_REFEREE_DISCOVERY_READER,
  matchInternalRefereeIdentity,
  isInternalRefereeAssignedToMatch,
  projectInternalRefereeHubMatch,
  listInternalRefereeHubAssignments,
  resolveAuthoritativeInternalRefereeRosterEntry,
  INTERNAL_REFEREE_IDENTITY_MATCH_METHOD,
  buildInternalRefereeMatchLiveRecord,
} from "./internalRefereeDiscovery.js";

export {
  resolveRefereeTokenScoreboardScope,
  findInternalMatchByRefereeToken,
  projectInternalRefereeTokenScoreboardRow,
  loadInternalCanonicalTokenScoreboard,
  loadRefereeTokenScoreboard,
} from "./internalRefereeTokenScoreboard.js";

export {
  CANONICAL_ENSURE_INTERNAL_REFEREE_MATCH_LIVE,
  isInternalRefereeEnsureToken,
  ensureInternalRefereeMatchLive,
} from "./internalRefereeRuntimeEnsure.js";

export {
  INTERNAL_REFEREE_CANONICAL_MODE,
  buildInternalRefereeCanonicalHref,
  buildInternalRefereePortalHref,
  buildInternalRefereeLegacyTokenHref,
  isInternalRefereeCanonicalRequest,
  isInternalRefereePortalPath,
} from "./internalRefereeCanonicalPath.js";

export {
  INTERNAL_REFEREE_PORTAL_FILTER,
  canAssignedInternalRefereeWriteMatch,
  classifyInternalRefereePortalBucket,
  resolveInternalRefereePortalActionLabel,
  orderInternalRefereePortalMatches,
  resolveNextInternalRefereeMatch,
  decorateInternalRefereePortalMatch,
  listInternalRefereePortalAssignments,
  resolveInternalRefereePortalLoadPresentation,
  projectInternalRefereePortalAfterCommit,
  formatInternalRefereePortalScore,
  resolveInternalRefereePortalStatusLabel,
} from "./internalRefereePortal.js";

export {
  CANONICAL_COMMIT_INTERNAL_REFEREE_MATCH_RESULT,
  INTERNAL_REFEREE_COMMIT_SQL_REQUIRED,
  projectInternalRefereeCanonicalMatchResult,
  projectInternalRefereeCanonicalEventResult,
  standingsFromInternalEvent,
  commitInternalRefereeMatchResult,
} from "./internalRefereeCanonicalCommit.js";

export {
  INTERNAL_PERSISTED_GROUP_FIELD,
  getInternalCanonicalEvent,
  listInternalPersistedGroups,
  countInternalPersistedGroups,
  resolveInternalGroupMemberLabels,
  selectAuthoritativeCanonicalTournament,
} from "./internalPersistedDrawGroups.js";

export {
  COMPETITION_UNIT,
  INTERNAL_TEAM_ID_FIELD,
  INTERNAL_TEAM_MEMBER_IDS_FIELD,
  INTERNAL_TEAM_DISPLAY_NAME_RULE,
  INTERNAL_TEAM_RATING_OR_SEED_FIELD,
  resolveInternalCompetitionUnit,
  listEntryPlayerIds,
  isTeamCompetitionEntry,
  isPlayerCompetitionEntry,
  entriesMatchCompetitionUnit,
  resolveInternalGroupingEntries,
  resolveGroupCompetitionEntries,
  inspectInternalGroupCompetitionUnit,
  inspectInternalGroupedCompetitionUnits,
  formatInternalGroupUnitChip,
  projectInternalGroupDrawCard,
} from "./internalTournamentCompetitionUnit.js";
