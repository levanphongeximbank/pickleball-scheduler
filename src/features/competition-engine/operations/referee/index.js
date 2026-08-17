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
  GENERIC_REFEREE_PERMISSIONS,
  GENERIC_REFEREE_ROLE_PERMISSIONS,
  REFEREE_ACTION_PERMISSION_MAP,
  resolveRefereeActionPermissions,
  isKnownRefereeAction,
  refereeMapRequiresTeamMatchResultManage,
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

export {
  CORE13_ASSIGNMENT_COMMAND_VERSION,
  ASSIGNMENT_COMMAND,
  ASSIGNMENT_OPERATION,
  ASSIGNMENT_LIFECYCLE_STATE,
  ASSIGNMENT_COMMAND_ERROR_CODE,
  ASSIGNMENT_COMPETITION_MODE,
  DURABLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION,
  TEST_DOUBLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION,
  CORE13_CANONICAL_ASSIGNMENT_RUNTIME,
  COMPETITION_REFEREE_ASSIGNMENT_EDGE_FUNCTION,
  CompetitionRefereeAssignmentCommandError,
  isCompetitionRefereeAssignmentCommandError,
  normalizeAssignmentLifecycleState,
  evaluateAssignmentLifecycleGate,
  assertAssignmentLifecycleGate,
  assertCanonicalRefereeId,
  assertAssignmentCommandAuthz,
  createInMemoryCanonicalAssignmentPersistence,
  createBlobCanonicalAssignmentPersistence,
  createRpcCanonicalAssignmentPersistence,
  createCompetitionRefereeAssignmentCommandService,
  createCompetitionRefereeAssignmentTrustedClient,
  createModeAssignmentCommandBridge,
  LEGACY_ASSIGNMENT_WRITER_STATUS,
} from "./assignment/index.js";

export {
  SCORING_ACTION_LEDGER_KIND,
  findLastEligibleScoringEvent,
  findScoringLedgerEntry,
  hasChangeEndAckAfterScoring,
  assertUndoLastScoringEligible,
  evaluateUndoAvailability,
} from "./scoring/undoLastScoringActionHelpers.js";

export const COMPETITION_ENGINE_REFEREE_OPERATIONS = Object.freeze({
  id: "competition-engine-referee-operations",
  phase: "E2E-04",
  version: "e2e-04-referee-operations-v1",
  wiredToProductionRuntime: true,
  inMemoryRuntimeClassification: "TEST_DOUBLE_ONLY",
  inMemoryProductionFallback: false,
  productionRuntimePortsDefined: true,
  productionRuntimeImplemented: true,
  defaultRuntimeWiringImplemented: true,
  stagingBackendCertified: true,
  ownsEngines: false,
  undoLastScoringAction: true,
  core13AssignmentCommand: true,
  seedAssignmentsCore13Bypass: false,
});
