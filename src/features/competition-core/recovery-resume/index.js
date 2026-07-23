/**
 * CORE-23 Competition Recovery & Resume — public capability surface.
 *
 * Ownership boundary (what CORE-23 owns):
 * - Recovery checkpoint / resume token / resume context
 * - Recovery eligibility / preconditions / plans / steps
 * - Partial-operation assessment + duplicate / idempotency references
 * - Last-known-safe state validation (evidence-driven)
 * - Recovery modes: RETRY / RESUME / REPLAY / ROLLBACK / MANUAL_RECOVERY
 * - Typed recovery errors + structured explanations
 * - Serializable recovery evidence suitable for future audit persistence
 *
 * Ownership boundary (what CORE-23 does NOT own):
 * - CORE-15 match lifecycle business rules
 * - CORE-19 workflow definition / transition rules (resumeWorkflow ≠ recovery)
 * - CORE-20 audit-event persistence
 * - CORE-21 deterministic seed generation / replay algorithms
 * - CORE-22 import/export package construction
 * - Database backup, UI, SQL, Supabase, deployment, production wiring
 *
 * Deterministic input requirement:
 * - Callers supply checkpoint evidence, versions, and idempotency keys.
 * - Kernel never invents wall-clock time or random identities.
 * - Evaluation is pure and side-effect free.
 *
 * Integrator owns root competition-core/index.js re-exports.
 */

export {
  CORE23_ENGINE_ID,
  CORE23_ENGINE_VERSION,
  CORE23_CONTRACT_ID,
  CORE23_SCHEMA_VERSION,
  RECOVERY_CHECKPOINT_SCHEMA_VERSION,
  RESUME_TOKEN_SCHEMA_VERSION,
  RECOVERY_PLAN_SCHEMA_VERSION,
  RECOVERY_OUTCOME_SCHEMA_VERSION,
  RECOVERY_REQUEST_SCHEMA_VERSION,
  CORE23_CHECKPOINT_FINGERPRINT_VERSION,
  CORE23_SOURCE,
  DEPENDENCY_MODULE_ID,
} from "./constants.js";

export {
  RECOVERY_MODE,
  RECOVERY_MODE_VALUES,
  isRecoveryMode,
  RECOVERY_ELIGIBILITY,
  RECOVERY_ELIGIBILITY_VALUES,
  isRecoveryEligibility,
  PARTIAL_OPERATION_STATUS,
  PARTIAL_OPERATION_STATUS_VALUES,
  isPartialOperationStatus,
  RECOVERY_OUTCOME_KIND,
  RECOVERY_OUTCOME_KIND_VALUES,
  isRecoveryOutcomeKind,
  RECOVERY_STEP_KIND,
  RECOVERY_STEP_KIND_VALUES,
  isRecoveryStepKind,
} from "./enums.js";

export {
  RECOVERY_ERROR_CODE,
  RECOVERY_ERROR_CODE_VALUES,
  isRecoveryErrorCode,
  RecoveryError,
  isRecoveryError,
  createRecoveryError,
} from "./errors.js";

export {
  createRecoverySubjectReference,
  createRecoveryOperationReference,
  createIdempotencyReference,
  createDuplicatePreventionReference,
  isRecoverySubjectReference,
  isRecoveryOperationReference,
  buildCheckpointIntegrityPayload,
  computeCheckpointIntegrityFingerprint,
  createLastKnownSafeState,
  createDependencyEvidence,
  createRecoveryCheckpoint,
  assertRecoveryCheckpoint,
  createResumeToken,
  createResumeContext,
  createRecoveryEvidence,
  createPartialOperationAssessment,
  createRecoveryPrecondition,
  createManualInterventionRequirement,
  createRecoveryExplanation,
  createRecoveryStep,
  createRecoveryPlan,
  createResumePlan,
  createRecoveryValidationResult,
  createRecoveryFailureReason,
  createRecoveryOutcome,
  createRecoveryRequest,
} from "./contracts/index.js";

export {
  validateRecoveryCheckpoint,
  classifyPartialOperation,
  buildRecoveryPlan,
  evaluateRecovery,
  assessRecoveryEligibility,
  isRecoveryRequest,
} from "./services/index.js";

export {
  adaptCore15MatchEvidence,
  adaptCore19WorkflowEvidence,
  adaptCore20AuditEvidence,
  adaptCore21ReplayEvidence,
  adaptCore22ImportRestoreEvidence,
} from "./adapters/index.js";

export {
  fingerprintValue,
  serializeCanonical,
  canonicalizeJsonValue,
  hashStringToUint32,
} from "./utils/fingerprint.js";
