/**
 * CORE-13 canonical assignment command surface — public barrel.
 */

export {
  CORE13_ASSIGNMENT_COMMAND_VERSION,
  ASSIGNMENT_COMMAND,
  ASSIGNMENT_COMMAND_VALUES,
  ASSIGNMENT_OPERATION,
  ASSIGNMENT_LIFECYCLE_STATE,
  ASSIGNMENT_LIFECYCLE_STATE_VALUES,
  ASSIGNMENT_COMMAND_ERROR_CODE,
  ASSIGNMENT_COMMAND_ERROR_CODE_VALUES,
  DURABLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION,
  TEST_DOUBLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION,
  ASSIGNMENT_COMPETITION_MODE,
} from "./constants.js";

export {
  CompetitionRefereeAssignmentCommandError,
  isCompetitionRefereeAssignmentCommandError,
  isAssignmentCommandErrorCode,
  failAssignmentCommand,
} from "./errors.js";

export {
  normalizeAssignmentLifecycleState,
  evaluateAssignmentLifecycleGate,
  assertAssignmentLifecycleGate,
} from "./evaluateLifecycleGate.js";

export {
  assertCanonicalRefereeId,
  assertAssignmentCommandAuthz,
} from "./assertAssignmentCommandAuthz.js";

export { createInMemoryCanonicalAssignmentPersistence } from "./persistence/createInMemoryCanonicalAssignmentPersistence.js";
export { createBlobCanonicalAssignmentPersistence } from "./persistence/createBlobCanonicalAssignmentPersistence.js";

export { createCompetitionRefereeAssignmentCommandService } from "./createCompetitionRefereeAssignmentCommandService.js";

export {
  createModeAssignmentCommandBridge,
  LEGACY_ASSIGNMENT_WRITER_STATUS,
} from "./mode/createModeAssignmentCommandBridge.js";

export const CORE13_CANONICAL_ASSIGNMENT_RUNTIME = Object.freeze({
  id: "core13-canonical-assignment-runtime",
  assignmentAuthority: "CORE-13",
  refereeDomainAuthority: "SINGLE",
  adapterBAuthority: "TRANSLATION_ONLY",
  contract08Changed: false,
  seedAssignmentsBypass: false,
  casRequired: true,
  idempotencyRequired: true,
  atomicReplacement: true,
  durableAudit: true,
  inMemoryProductionFallback: false,
});
