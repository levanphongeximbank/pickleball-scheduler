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
  INTERNAL_PERSISTED_GROUP_FIELD,
  getInternalCanonicalEvent,
  listInternalPersistedGroups,
  countInternalPersistedGroups,
  resolveInternalGroupMemberLabels,
  selectAuthoritativeCanonicalTournament,
} from "./internalPersistedDrawGroups.js";
