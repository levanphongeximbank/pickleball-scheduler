export {
  SHOWCASE_STAGE,
  SHOWCASE_MODE,
  SHOWCASE_COPY,
  SHOWCASE_DEFAULT_TEAM_COUNT,
  SHOWCASE_COUNTDOWN_SECONDS,
  PROCESSING_STAGES,
} from "./showcaseConstants.js";

export {
  buildShowcasePreflight,
  canShowShowcaseEntry,
  canShowShowcaseReplay,
} from "./showcasePreflight.js";

export {
  generateShowcaseTeamDraw,
  generateShowcaseGroupDraw,
  buildReplayShowcaseSession,
  assertMembershipUnchanged,
  assertGroupMembershipUnchanged,
  cloneShowcaseSession,
} from "./showcaseDrawSession.js";

export {
  createInitialShowcaseState,
  reduceShowcaseState,
  showcaseAllowsCancel,
  showcaseResultIsLocked,
  createShowcaseIdempotencyKey,
} from "./showcaseMachine.js";

export {
  confirmShowcasePersistence,
  assertNoShowcaseWrite,
} from "./showcasePersistenceAdapter.js";

// UI shell is imported directly from TeamTournamentShowcase.jsx
// so Node unit tests can load this barrel without JSX.
