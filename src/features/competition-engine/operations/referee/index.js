/**
 * E2E-04 Referee Competition Operations — public barrel.
 */

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
} from "./constants.js";

export {
  RefereeOperationsError,
  isRefereeOperationsError,
  isRefereeErrorCode,
  failReferee,
  normalizeRefereeError,
} from "./errors.js";

export {
  REFEREE_CAPABILITY,
  REFEREE_ACTION_PERMISSION_MAP,
  resolveRefereeActionPermissions,
  isKnownRefereeAction,
} from "./permissions/refereeActionMap.js";

export {
  authorizeRefereeCommand,
  rejectClientGrantedPermissions,
} from "./context/authorizeRefereeCommand.js";

export {
  assertRefereeAssignmentScope,
  isActiveRefereeAssignmentStatus,
} from "./context/assertRefereeAssignment.js";

export {
  createInMemoryRefereeOperationsStore,
  refereeScopeKey,
} from "./store/createInMemoryRefereeOperationsStore.js";

export { buildRefereeOperationsProjection } from "./projections/buildRefereeOperationsProjection.js";

export { createRefereeCompetitionOperationsFacade } from "./createRefereeCompetitionOperationsFacade.js";

export const COMPETITION_ENGINE_REFEREE_OPERATIONS = Object.freeze({
  id: "competition-engine-referee-operations",
  phase: "E2E-04",
  version: "e2e-04-referee-operations-v1",
  wiredToProductionRuntime: false,
  ownsEngines: false,
});
