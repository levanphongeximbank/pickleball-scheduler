/**
 * E2E-03 Organizer Operations — public barrel.
 * E2E-04 Player / Referee Operations exported selectively (additive).
 */

export {
  E2E03_OPERATIONS_VERSION,
  E2E03_OPERATIONS_PHASE,
  ORGANIZER_ACTION,
  ORGANIZER_ACTION_VALUES,
  ORGANIZER_LIFECYCLE_STATE,
  ORGANIZER_LIFECYCLE_STATE_VALUES,
  PARTICIPANT_FIELD_STATE,
  CHECKIN_STATE,
  MATCH_OPS_STATE,
  PUBLICATION_OPS_STATE,
  ENTRY_OPS_STATUS,
  ORGANIZER_BLOCKER_CODE,
  ORGANIZER_ERROR_CODE,
  ORGANIZER_ERROR_CODE_VALUES,
} from "./constants.js";

export {
  OrganizerOperationsError,
  isOrganizerOperationsError,
  isOrganizerErrorCode,
  failOrganizer,
  normalizeOrganizerError,
} from "./errors.js";

export {
  ORGANIZER_CAPABILITY,
  ORGANIZER_ACTION_PERMISSION_MAP,
  resolveOrganizerActionPermissions,
  isKnownOrganizerAction,
} from "./permissions/organizerActionMap.js";

export {
  authorizeOrganizerCommand,
  rejectClientGrantedPermissions,
} from "./context/authorizeOrganizerCommand.js";

export {
  createInMemoryOrganizerOperationsStore,
  organizerScopeKey,
} from "./store/createInMemoryOrganizerOperationsStore.js";

export { buildOrganizerOperationsProjection } from "./projections/buildOrganizerOperationsProjection.js";

export {
  summarizeOrganizerCheckIn,
  assertMatchOpsCheckInGate,
  applyOpenCheckIn,
  applyCloseCheckIn,
} from "./checkin/organizerCheckInBoundary.js";

export {
  createOrganizerOperationsFacade,
  getOrganizerCompetitionOperationsState,
} from "./createOrganizerOperationsFacade.js";

export {
  computeOrganizerFingerprint,
  deepFreeze,
  clonePlain,
  snapshotInput,
  stableStringify,
} from "./fingerprint.js";

export const COMPETITION_ENGINE_ORGANIZER_OPERATIONS = Object.freeze({
  id: "competition-engine-organizer-operations",
  phase: "E2E-03",
  version: "e2e-03-organizer-operations-v1",
  wiredToProductionRuntime: false,
  ownsEngines: false,
});

// ─── E2E-04 Player (selective — avoid rejectClientGrantedPermissions clash) ───
export {
  E2E04_PLAYER_OPERATIONS_VERSION,
  E2E04_PLAYER_OPERATIONS_PHASE,
  PLAYER_ACTION,
  PLAYER_ACTION_VALUES,
  PLAYER_CHECKIN_MARK,
  PLAYER_BLOCKER_CODE,
  PLAYER_ERROR_CODE,
  PLAYER_ERROR_CODE_VALUES,
  PlayerOperationsError,
  isPlayerOperationsError,
  isPlayerErrorCode,
  failPlayer,
  normalizePlayerError,
  PLAYER_CAPABILITY,
  PLAYER_ACTION_PERMISSION_MAP,
  resolvePlayerActionPermissions,
  isKnownPlayerAction,
  authorizePlayerCommand,
  resolvePlayerEntryOwnership,
  summarizePlayerCheckIn,
  assertPlayerCheckInAllowed,
  applyPlayerCheckInMark,
  buildPlayerOperationsProjection,
  createPlayerCompetitionOperationsFacade,
  getPlayerCompetitionState,
  COMPETITION_ENGINE_PLAYER_OPERATIONS,
} from "./player/index.js";

// ─── E2E-04 Referee ───────────────────────────────────────────────────────────
export {
  E2E04_REFEREE_OPERATIONS_VERSION,
  E2E04_REFEREE_OPERATIONS_PHASE,
  REFEREE_ACTION,
  REFEREE_ACTION_VALUES,
  REFEREE_ASSIGNMENT_OPS_STATUS,
  REFEREE_VALIDATION_OPS_STATUS,
  REFEREE_BLOCKER_CODE,
  REFEREE_ERROR_CODE,
  REFEREE_ERROR_CODE_VALUES,
  RefereeOperationsError,
  isRefereeOperationsError,
  isRefereeErrorCode,
  failReferee,
  normalizeRefereeError,
  REFEREE_CAPABILITY,
  REFEREE_ACTION_PERMISSION_MAP,
  resolveRefereeActionPermissions,
  isKnownRefereeAction,
  authorizeRefereeCommand,
  assertRefereeAssignmentScope,
  isActiveRefereeAssignmentStatus,
  createInMemoryRefereeOperationsStore,
  refereeScopeKey,
  buildRefereeOperationsProjection,
  createRefereeCompetitionOperationsFacade,
  COMPETITION_ENGINE_REFEREE_OPERATIONS,
} from "./referee/index.js";
