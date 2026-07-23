/**
 * CORE-19 Competition Workflow Engine — public capability surface (Phase 1E).
 *
 * Ownership boundary (what CORE-19 owns):
 * - Workflow definition / state / step / transition kernel
 * - Decision composition (authorization, prerequisites, guards)
 * - Dependency adapters (CORE-01 / 15 / 16 / 17 / 18 → workflow decisions)
 * - Transition effect evaluation from supplied pure outcomes
 * - Workflow-level control (pause / resume / restart / fail / complete)
 * - Domain event construction (identity-complete; not an audit store)
 *
 * Ownership boundary (what CORE-19 does NOT own):
 * - CORE-01 constraint rule logic
 * - CORE-15 match lifecycle / transition matrix
 * - CORE-16 scoring mutation
 * - CORE-17 result validation ownership
 * - CORE-18 standings / tie-break calculation
 * - CORE-20 audit persistence / event log storage
 * - CORE-21 deterministic replay execution
 * - CORE-22 import / export
 * - CORE-23 recovery eligibility / recovery execution
 * - UI, routes, SQL, cloud database wiring, or production runtime wiring
 *
 * Deterministic input requirement:
 * - Callers must supply occurredAt and eventId (or eventIdFactory).
 * - Kernel never invents wall-clock time or random identities.
 *
 * Effect outcome boundary:
 * - Effects are validated/composed from supplied pure outcomes only.
 * - applyWorkflowTransition never executes external effects.
 *
 * Restart vs recovery boundary:
 * - restartWorkflow is a workflow-level control operation.
 * - It never invokes CORE-23 recovery eligibility or recovery execution.
 *
 * Event generation vs audit persistence boundary:
 * - CORE-19 emits immutable domain workflow events in-memory.
 * - Persistence, audit storage, and event-log indexing belong to CORE-20.
 *
 * Duplicate operation policy (canonical across transition + control):
 * - same idempotency key + same payload fingerprint → deterministic no-op
 * - same idempotency key + different payload fingerprint → DETERMINISTIC_INPUT_VIOLATION
 * - Phase 1B seenIdempotencyKeys (no fingerprint) → DUPLICATE_TRANSITION_REQUEST deny
 *
 * Integrator owns root competition-core/index.js re-exports — do not edit that here.
 *
 * Intentional public utilities: canonicalize/fingerprint helpers and
 * resolveDuplicateOperation (integrator-facing deterministic contracts).
 * Internal-only: services/controlHelpers.js (not exported).
 */

export {
  WORKFLOW_STATUS,
  WORKFLOW_STATUS_VALUES,
  WORKFLOW_TERMINAL_STATUSES,
  WORKFLOW_TERMINAL_STATUS_SET,
  isWorkflowStatus,
  isTerminalWorkflowStatus,
  WORKFLOW_EVENT_TYPE,
  WORKFLOW_EVENT_TYPE_VALUES,
  isWorkflowEventType,
} from "./enums/index.js";

export {
  WORKFLOW_ERROR_CODE,
  WORKFLOW_ERROR_CODE_VALUES,
  isWorkflowErrorCode,
  WorkflowError,
  isWorkflowError,
  createWorkflowError,
} from "./errors/index.js";

export {
  createWorkflowStep,
  assertWorkflowStep,
  createWorkflowTransitionDefinition,
  assertWorkflowTransitionDefinition,
  createWorkflowDefinition,
  assertWorkflowDefinition,
  findWorkflowTransitionById,
  findWorkflowStepById,
  createWorkflowState,
  assertWorkflowState,
  createWorkflowTransitionRequest,
  assertWorkflowTransitionRequest,
  createWorkflowTransitionContext,
  assertWorkflowTransitionContext,
  createTransitionAuthorizationDecision,
  createTransitionPrerequisiteResult,
  createTransitionGuardDecision,
  createTransitionExplanation,
  buildWorkflowEventId,
  createWorkflowEvent,
  createWorkflowEvaluationResult,
  createWorkflowTransitionResult,
  WORKFLOW_EFFECT_STATUS,
  WORKFLOW_EFFECT_STATUS_VALUES,
  isWorkflowEffectStatus,
  createWorkflowEffectDescriptor,
  assertWorkflowEffectDescriptor,
  createWorkflowEffectResult,
  sortWorkflowEffectDescriptors,
  WORKFLOW_CONTROL_OPERATION,
  WORKFLOW_CONTROL_OPERATION_VALUES,
  createWorkflowControlRequest,
  assertWorkflowControlRequest,
  createWorkflowControlResult,
  createWorkflowResumeRequest,
  assertWorkflowResumeRequest,
  WORKFLOW_RESTART_MODE,
  WORKFLOW_RESTART_MODE_VALUES,
  createWorkflowRestartRequest,
  assertWorkflowRestartRequest,
} from "./contracts/index.js";

export {
  evaluateWorkflowTransition,
  applyWorkflowTransition,
  composeAuthorizationDecision,
  composePrerequisiteResults,
  composeGuardDecisions,
  evaluateTransitionEffects,
  applyTransitionEffects,
  orchestrateWorkflowTransition,
  pauseWorkflow,
  resumeWorkflow,
  restartWorkflow,
  failWorkflow,
  completeWorkflow,
} from "./services/index.js";

export {
  adaptCore01GuardDecision,
  adaptCore15MatchPrerequisite,
  adaptCore16ScoringSignal,
  adaptCore17ResultValidationGate,
  adaptCore18StandingsCompletion,
} from "./adapters/index.js";

export {
  createSuppliedWorkflowEffectPort,
  createNullWorkflowEffectPort,
} from "./ports/index.js";

export {
  WORKFLOW_PAYLOAD_FINGERPRINT_V1,
  canonicalizeWorkflowPayload,
  serializeCanonicalWorkflowPayload,
  createWorkflowPayloadFingerprint,
  resolveDuplicateOperation,
} from "./utils/index.js";
