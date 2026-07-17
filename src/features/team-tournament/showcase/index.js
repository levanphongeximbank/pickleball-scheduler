export {
  SHOWCASE_STAGE,
  SHOWCASE_MODE,
  SHOWCASE_COPY,
  SHOWCASE_DEFAULT_TEAM_COUNT,
  SHOWCASE_COUNTDOWN_SECONDS,
  SHOWCASE_REVEAL_STEP_MS,
  SHOWCASE_REVEAL_STEP_MS_REDUCED,
  PROCESSING_STAGES,
} from "./showcaseConstants.js";

export {
  buildShowcasePreflight,
  canShowShowcaseEntry,
  canShowShowcaseReplay,
} from "./showcasePreflight.js";

export {
  SHOWCASE_CLUB_SCOPE,
  mergeShowcaseAthletePool,
  buildShowcaseAthleteCounters,
  buildShowcaseTeamConfiguration,
  buildShowcaseTeamPreviewDiagnostics,
  buildShowcaseGroupPreviewDiagnostics,
  buildShowcaseActionGates,
  selectAllEligibleShowcaseAthletes,
  selectEligibleShowcaseAthletesInFilter,
  clearFilteredShowcaseAthleteSelection,
  clearShowcaseAthleteSelection,
  assignShowcaseCaptain,
  resolveShowcaseClubScopeConfig,
  resolveShowcasePermittedClubs,
  tournamentAllowsTenantAthleteScope,
  isShowcaseHostClubRestricted,
  isTournamentHostClubAthletesOnly,
  canShowcaseSelectTenantAthleteScope,
  filterShowcaseAthletesForDisplay,
} from "./showcaseSetupModel.js";

export { reconcileSelectedAthletesForEngineInput } from "./reconcileSelectedAthletesForEngineInput.js";

export { canTransitionShowcaseStage } from "./showcaseStateGuards.js";

export {
  generateShowcaseTeamDraw,
  generateShowcaseGroupDraw,
  buildReplayShowcaseSession,
  assertMembershipUnchanged,
  assertGroupMembershipUnchanged,
  cloneShowcaseSession,
} from "./showcaseDrawSession.js";

export {
  buildShowcaseTeamRevealSteps,
  buildShowcaseGroupRevealSteps,
  assertTeamRevealParity,
  assertGroupRevealParity,
  selectRevealedTeamState,
  selectRevealedGroupState,
} from "./showcaseRevealSteps.js";

export { buildAiPairingRevealSession } from "./buildAiPairingRevealSession.js";

export { buildAiGroupRevealSession } from "./buildAiGroupRevealSession.js";

export { generateShowcaseMatchupPreview } from "./showcaseMatchupSession.js";

export {
  createInitialShowcaseState,
  reduceShowcaseState,
  showcaseAllowsCancel,
  showcaseResultIsLocked,
  createShowcaseIdempotencyKey,
} from "./showcaseMachine.js";

export {
  confirmShowcasePersistence,
  confirmShowcaseMatchupPersistence,
  assertNoShowcaseWrite,
} from "./showcasePersistenceAdapter.js";

// UI shell is imported directly from TeamTournamentShowcase.jsx
// so Node unit tests can load this barrel without JSX.
