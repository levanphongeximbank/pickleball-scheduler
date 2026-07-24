/**
 * E2E-03 Organizer Operations — public barrel.
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
