/**
 * E2E-05 Public Competition Experience — public barrel.
 */

export {
  E2E05_PUBLIC_EXPERIENCE_VERSION,
  E2E05_PUBLIC_EXPERIENCE_PHASE,
  PUBLIC_QUERY,
  PUBLIC_QUERY_VALUES,
  PUBLIC_AVAILABILITY,
  PUBLIC_AVAILABILITY_VALUES,
  PUBLIC_MATCH_STATUS,
  PUBLIC_MATCH_STATUS_VALUES,
  PUBLIC_BLOCKER_CODE,
  PUBLIC_ERROR_CODE,
  PUBLIC_ERROR_CODE_VALUES,
  PUBLICATION_VISIBILITY_DEFAULTS,
} from "./constants.js";

export {
  PublicCompetitionExperienceError,
  isPublicCompetitionExperienceError,
  isPublicErrorCode,
  failPublic,
  normalizePublicError,
} from "./errors.js";

export {
  computePublicFingerprint,
  deepFreeze,
  clonePlain,
  snapshotInput,
  stableStringify,
  isNonEmptyString,
} from "./fingerprint.js";

export {
  resolvePublicVisibility,
  requirePublicScope,
  assertPublicTenantScope,
  assertCompetitionPublished,
  assertSchedulePublished,
  assertParticipantsVisible,
  assertResultsPublished,
  assertBracketPublished,
  assertFinalResultsPublished,
  assertArchiveVisible,
} from "./gates/publicationPrivacyGates.js";

export {
  pickAllowlisted,
  stripForbiddenKeys,
  PUBLIC_OVERVIEW_FIELDS,
  PUBLIC_PARTICIPANT_FIELDS,
  PUBLIC_SCHEDULE_MATCH_FIELDS,
  PUBLIC_COURT_FIELDS,
  PUBLIC_POOL_GROUP_FIELDS,
  PUBLIC_STANDING_ROW_FIELDS,
  PUBLIC_QUALIFIER_FIELDS,
  PUBLIC_BRACKET_SLOT_FIELDS,
  PUBLIC_MATCH_CENTER_FIELDS,
  PUBLIC_FINAL_RESULT_FIELDS,
  PUBLIC_FORBIDDEN_KEYS,
} from "./projections/allowlists.js";

export {
  buildPublicOverviewProjection,
  buildPublicParticipantsProjection,
  buildPublicScheduleProjection,
  buildPublicPoolsProjection,
  buildPublicStandingsProjection,
  buildPublicQualificationProjection,
  buildPublicBracketProjection,
  buildPublicMatchCenterProjection,
  buildPublicFinalResultsProjection,
  buildPublicArchiveProjection,
  buildPublicCompetitionExperienceProjection,
} from "./projections/buildPublicCompetitionProjection.js";

export { mapPublicMatchStatus, mapPublicScore } from "./projections/mapMatchStatus.js";

export { projectPublishedRecordFromOrganizer } from "./adapters/projectPublishedRecordFromOrganizer.js";

export {
  createInMemoryPublicExperienceStore,
  publicScopeKey,
} from "./store/createInMemoryPublicExperienceStore.js";

export {
  createPublicCompetitionExperienceFacade,
  getPublicCompetitionExperienceState,
} from "./createPublicCompetitionExperienceFacade.js";

export const COMPETITION_ENGINE_PUBLIC_EXPERIENCE = Object.freeze({
  id: "competition-engine-public-experience",
  phase: "E2E-05",
  version: "e2e-05-public-experience-v1",
  wiredToProductionRuntime: false,
  ownsEngines: false,
});
