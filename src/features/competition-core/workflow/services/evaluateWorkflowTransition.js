/**
 * CORE-19 — pure deterministic transition evaluator.
 * Never mutates inputs. Never executes effects. Never persists.
 * Never invents wall-clock time or randomness.
 */

import {
  WORKFLOW_STATUS,
  isTerminalWorkflowStatus,
} from "../enums/workflowStatuses.js";
import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { WorkflowError } from "../errors/WorkflowError.js";
import {
  assertWorkflowDefinition,
  findWorkflowStepById,
  findWorkflowTransitionById,
} from "../contracts/workflowDefinition.js";
import { assertWorkflowState } from "../contracts/workflowState.js";
import { createWorkflowTransitionRequest } from "../contracts/workflowTransitionRequest.js";
import { createWorkflowTransitionContext } from "../contracts/workflowTransitionContext.js";
import { createTransitionExplanation } from "../contracts/transitionExplanation.js";
import { createWorkflowEvaluationResult } from "../contracts/workflowTransitionResult.js";
import { isPlainObject } from "../utils/canonicalizeWorkflowPayload.js";
import { composeAuthorizationDecision } from "./composeAuthorizationDecision.js";
import { composePrerequisiteResults } from "./composePrerequisiteResults.js";
import { composeGuardDecisions } from "./composeGuardDecisions.js";

/**
 * Normalize Phase 1B context inputs that may supply composable collections.
 * Does not invoke dependency adapters.
 *
 * @param {unknown} context
 * @returns {unknown}
 */
function normalizeComposableContext(context) {
  if (!isPlainObject(context)) return context;
  const next = { ...context };

  if (Array.isArray(context.authorization)) {
    next.authorization = composeAuthorizationDecision(context.authorization);
  } else if (
    context.authorization == null &&
    Array.isArray(context.authorizationDecisions)
  ) {
    next.authorization = composeAuthorizationDecision(
      context.authorizationDecisions
    );
  } else if (
    isPlainObject(context.authorization) &&
    Array.isArray(context.authorization.decisions)
  ) {
    next.authorization = composeAuthorizationDecision(context.authorization);
  }

  if (Array.isArray(context.prerequisites)) {
    const composed = composePrerequisiteResults(context.prerequisites);
    next.prerequisites = composed.results;
    next.__composedPrerequisiteWarnings = composed.warnings;
  }

  if (Array.isArray(context.guards)) {
    const composed = composeGuardDecisions(context.guards);
    next.guards = composed.decisions;
    next.__composedGuardWarnings = composed.warnings;
  }

  return next;
}

/**
 * @param {string} status
 * @returns {string}
 */
function terminalErrorCode(status) {
  if (status === WORKFLOW_STATUS.COMPLETED) {
    return WORKFLOW_ERROR_CODE.WORKFLOW_COMPLETED;
  }
  if (status === WORKFLOW_STATUS.FAILED) {
    return WORKFLOW_ERROR_CODE.WORKFLOW_FAILED;
  }
  if (status === WORKFLOW_STATUS.CANCELLED) {
    return WORKFLOW_ERROR_CODE.WORKFLOW_CANCELLED;
  }
  return WORKFLOW_ERROR_CODE.TRANSITION_NOT_ALLOWED;
}

/**
 * @param {object} args
 * @returns {Readonly<import('../contracts/workflowTransitionResult.js').WorkflowEvaluationResult>}
 */
function deny(args) {
  const {
    code,
    message,
    transitionId = "",
    fromStepId = null,
    toStepId = null,
    fromStatus = null,
    toStatus = null,
    details = {},
    guardReasons = [],
    prerequisiteReasons = [],
    authorizationReason = null,
    dependencyReferences = [],
  } = args;

  return createWorkflowEvaluationResult({
    ok: false,
    approved: false,
    code,
    transitionId,
    fromStepId,
    toStepId,
    fromStatus,
    toStatus,
    details,
    explanation: createTransitionExplanation({
      code,
      message,
      details,
      guardReasons,
      prerequisiteReasons,
      authorizationReason,
      dependencyReferences,
    }),
  });
}

/**
 * Evaluate whether a workflow transition may proceed.
 *
 * @param {object} input
 * @param {unknown} input.definition
 * @param {unknown} input.state
 * @param {unknown} input.request
 * @param {unknown} input.context
 * @returns {Readonly<import('../contracts/workflowTransitionResult.js').WorkflowEvaluationResult>}
 */
export function evaluateWorkflowTransition(input = {}) {
  if (!isPlainObject(input)) {
    return deny({
      code: WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      message: "evaluateWorkflowTransition input must be a plain object",
    });
  }

  let definition;
  let state;
  let request;
  let context;

  try {
    definition = assertWorkflowDefinition(input.definition);
  } catch (err) {
    const code =
      err instanceof WorkflowError
        ? err.code
        : WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION;
    return deny({
      code,
      message:
        err instanceof Error
          ? err.message
          : "Invalid workflow definition",
      details: err instanceof WorkflowError ? err.details : {},
    });
  }

  try {
    state = assertWorkflowState(input.state);
  } catch (err) {
    const code =
      err instanceof WorkflowError
        ? err.code
        : WORKFLOW_ERROR_CODE.UNKNOWN_STATE;
    return deny({
      code,
      message: err instanceof Error ? err.message : "Invalid workflow state",
      details: err instanceof WorkflowError ? err.details : {},
    });
  }

  try {
    request = createWorkflowTransitionRequest(input.request);
  } catch (err) {
    const code =
      err instanceof WorkflowError
        ? err.code
        : WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION;
    return deny({
      code,
      message:
        err instanceof Error ? err.message : "Invalid transition request",
      details: err instanceof WorkflowError ? err.details : {},
    });
  }

  /** @type {string[]} */
  let composedPrerequisiteWarnings = [];
  /** @type {string[]} */
  let composedGuardWarnings = [];

  try {
    const normalizedContextInput = normalizeComposableContext(input.context);
    if (isPlainObject(normalizedContextInput)) {
      composedPrerequisiteWarnings = Array.isArray(
        normalizedContextInput.__composedPrerequisiteWarnings
      )
        ? [...normalizedContextInput.__composedPrerequisiteWarnings]
        : [];
      composedGuardWarnings = Array.isArray(
        normalizedContextInput.__composedGuardWarnings
      )
        ? [...normalizedContextInput.__composedGuardWarnings]
        : [];
      const {
        __composedPrerequisiteWarnings,
        __composedGuardWarnings,
        ...contextForCreate
      } = normalizedContextInput;
      void __composedPrerequisiteWarnings;
      void __composedGuardWarnings;
      context = createWorkflowTransitionContext(contextForCreate);
    } else {
      context = createWorkflowTransitionContext(input.context);
    }
  } catch (err) {
    const code =
      err instanceof WorkflowError
        ? err.code
        : WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION;
    return deny({
      code,
      message:
        err instanceof Error ? err.message : "Invalid transition context",
      transitionId: request.transitionId,
      details: err instanceof WorkflowError ? err.details : {},
    });
  }

  if (
    state.definitionId !== definition.definitionId ||
    state.definitionVersion !== definition.definitionVersion
  ) {
    return deny({
      code: WORKFLOW_ERROR_CODE.UNKNOWN_WORKFLOW,
      message: "Workflow state does not match definition identity",
      transitionId: request.transitionId,
      fromStepId: state.currentStepId,
      fromStatus: state.status,
      details: {
        stateDefinitionId: state.definitionId,
        stateDefinitionVersion: state.definitionVersion,
        definitionId: definition.definitionId,
        definitionVersion: definition.definitionVersion,
      },
    });
  }

  if (
    request.workflowInstanceId != null &&
    request.workflowInstanceId !== state.workflowInstanceId
  ) {
    return deny({
      code: WORKFLOW_ERROR_CODE.UNKNOWN_WORKFLOW,
      message: "Request workflowInstanceId does not match state",
      transitionId: request.transitionId,
      fromStepId: state.currentStepId,
      fromStatus: state.status,
      details: {
        requestWorkflowInstanceId: request.workflowInstanceId,
        stateWorkflowInstanceId: state.workflowInstanceId,
      },
    });
  }

  if (context.seenIdempotencyKeys.includes(request.idempotencyKey)) {
    return deny({
      code: WORKFLOW_ERROR_CODE.DUPLICATE_TRANSITION_REQUEST,
      message: "Duplicate idempotency key for transition request",
      transitionId: request.transitionId,
      fromStepId: state.currentStepId,
      fromStatus: state.status,
      details: { idempotencyKey: request.idempotencyKey },
    });
  }

  if (isTerminalWorkflowStatus(state.status)) {
    const code = terminalErrorCode(state.status);
    return deny({
      code,
      message: `Terminal workflow status ${state.status} cannot perform normal transitions`,
      transitionId: request.transitionId,
      fromStepId: state.currentStepId,
      fromStatus: state.status,
      details: { status: state.status },
    });
  }

  const currentStep = findWorkflowStepById(definition, state.currentStepId);
  if (!currentStep) {
    return deny({
      code: WORKFLOW_ERROR_CODE.UNKNOWN_STEP,
      message: "Current step is not present in workflow definition",
      transitionId: request.transitionId,
      fromStepId: state.currentStepId,
      fromStatus: state.status,
    });
  }

  const transition = findWorkflowTransitionById(
    definition,
    request.transitionId
  );
  if (!transition) {
    return deny({
      code: WORKFLOW_ERROR_CODE.UNKNOWN_TRANSITION,
      message: `Unknown transitionId: ${request.transitionId}`,
      transitionId: request.transitionId,
      fromStepId: state.currentStepId,
      fromStatus: state.status,
    });
  }

  if (transition.fromStepId !== state.currentStepId) {
    return deny({
      code: WORKFLOW_ERROR_CODE.TRANSITION_NOT_ALLOWED,
      message: "Transition does not start from the current step",
      transitionId: transition.transitionId,
      fromStepId: state.currentStepId,
      toStepId: transition.toStepId,
      fromStatus: state.status,
      toStatus: transition.toStatus,
      details: {
        expectedFromStepId: transition.fromStepId,
        currentStepId: state.currentStepId,
      },
    });
  }

  const allowedFrom = transition.allowedFromStatuses || [transition.fromStatus];
  const runningOnly =
    transition.requiresRunning === true ||
    (allowedFrom.length === 1 && allowedFrom[0] === WORKFLOW_STATUS.RUNNING);

  // Prefer WORKFLOW_PAUSED over generic not-allowed when a RUNNING-only
  // transition is attempted while the workflow is paused.
  if (state.status === WORKFLOW_STATUS.PAUSED && runningOnly) {
    return deny({
      code: WORKFLOW_ERROR_CODE.WORKFLOW_PAUSED,
      message: "RUNNING-only transition rejected while workflow is PAUSED",
      transitionId: transition.transitionId,
      fromStepId: state.currentStepId,
      toStepId: transition.toStepId,
      fromStatus: state.status,
      toStatus: transition.toStatus,
    });
  }

  if (
    transition.requiresRunning === true &&
    state.status !== WORKFLOW_STATUS.RUNNING
  ) {
    return deny({
      code: WORKFLOW_ERROR_CODE.TRANSITION_NOT_ALLOWED,
      message: "Transition requires RUNNING workflow status",
      transitionId: transition.transitionId,
      fromStepId: state.currentStepId,
      toStepId: transition.toStepId,
      fromStatus: state.status,
      toStatus: transition.toStatus,
    });
  }

  if (!allowedFrom.includes(state.status)) {
    return deny({
      code: WORKFLOW_ERROR_CODE.TRANSITION_NOT_ALLOWED,
      message: "Transition is not allowed from the current workflow status",
      transitionId: transition.transitionId,
      fromStepId: state.currentStepId,
      toStepId: transition.toStepId,
      fromStatus: state.status,
      toStatus: transition.toStatus,
      details: {
        expectedFromStatuses: [...allowedFrom],
        currentStatus: state.status,
      },
    });
  }

  const targetStep = findWorkflowStepById(definition, transition.toStepId);
  if (!targetStep) {
    return deny({
      code: WORKFLOW_ERROR_CODE.UNKNOWN_STEP,
      message: "Transition target step is not present in workflow definition",
      transitionId: transition.transitionId,
      fromStepId: state.currentStepId,
      toStepId: transition.toStepId,
      fromStatus: state.status,
    });
  }

  const authorization = context.authorization;
  if (!authorization || authorization.allowed !== true) {
    const authorizationReason =
      authorization?.reason ||
      authorization?.decisionCode ||
      "Authorization denied or missing";
    const denialReasons = Array.isArray(authorization?.details?.denialReasons)
      ? [...authorization.details.denialReasons]
      : [];
    return deny({
      code: WORKFLOW_ERROR_CODE.TRANSITION_UNAUTHORIZED,
      message: "Transition authorization denied",
      transitionId: transition.transitionId,
      fromStepId: state.currentStepId,
      toStepId: transition.toStepId,
      fromStatus: state.status,
      toStatus: transition.toStatus,
      authorizationReason,
      details: {
        decisionCode: authorization?.decisionCode ?? null,
        missingAuthorizationContext:
          authorization?.details?.missingAuthorizationContext === true ||
          authorization == null,
        actorDenial: authorization?.details?.actorDenial === true,
        denialReasons,
      },
    });
  }

  const composedPrereqs = composePrerequisiteResults(context.prerequisites);
  if (composedPrereqs.satisfied !== true) {
    const dependencyReferences = [
      ...context.dependencyReferences,
      ...composedPrereqs.dependencyReferences,
    ];
    return deny({
      code: WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
      message: "One or more prerequisites are not satisfied",
      transitionId: transition.transitionId,
      fromStepId: state.currentStepId,
      toStepId: transition.toStepId,
      fromStatus: state.status,
      toStatus: transition.toStatus,
      prerequisiteReasons: [...composedPrereqs.blockingReasons],
      dependencyReferences,
      details: {
        failedCount: composedPrereqs.failedPrerequisiteIds.length,
        codes: [...composedPrereqs.errorCodes],
        failedPrerequisiteIds: [...composedPrereqs.failedPrerequisiteIds],
        warnings: [
          ...composedPrerequisiteWarnings,
          ...composedPrereqs.warnings,
        ],
      },
    });
  }

  const composedGuards = composeGuardDecisions(context.guards);
  if (composedGuards.allowed !== true) {
    const dependencyReferences = [
      ...context.dependencyReferences,
      ...composedGuards.dependencyReferences,
    ];
    return deny({
      code: WORKFLOW_ERROR_CODE.GUARD_REJECTED,
      message: "One or more guards rejected the transition",
      transitionId: transition.transitionId,
      fromStepId: state.currentStepId,
      toStepId: transition.toStepId,
      fromStatus: state.status,
      toStatus: transition.toStatus,
      guardReasons: [...composedGuards.blockingReasons],
      dependencyReferences,
      details: {
        failedCount: composedGuards.blockingReasons.length,
        codes: composedGuards.decisions
          .filter((g) => g.allowed !== true)
          .map((g) => g.code)
          .filter(Boolean),
        warnings: [...composedGuardWarnings, ...composedGuards.warnings],
      },
    });
  }

  return createWorkflowEvaluationResult({
    ok: true,
    approved: true,
    code: null,
    transitionId: transition.transitionId,
    fromStepId: state.currentStepId,
    toStepId: transition.toStepId,
    fromStatus: state.status,
    toStatus: transition.toStatus,
    details: {
      definitionId: definition.definitionId,
      definitionVersion: definition.definitionVersion,
      workflowInstanceId: state.workflowInstanceId,
      requiresRunning: transition.requiresRunning === true,
      warnings: Object.freeze([
        ...composedPrerequisiteWarnings,
        ...composedPrereqs.warnings,
        ...composedGuardWarnings,
        ...composedGuards.warnings,
      ]),
    },
    explanation: createTransitionExplanation({
      code: "TRANSITION_APPROVED",
      message: `Transition ${transition.transitionId} approved`,
      details: {
        fromStepId: state.currentStepId,
        toStepId: transition.toStepId,
        fromStatus: state.status,
        toStatus: transition.toStatus,
        warnings: Object.freeze([
          ...composedPrerequisiteWarnings,
          ...composedPrereqs.warnings,
          ...composedGuardWarnings,
          ...composedGuards.warnings,
        ]),
      },
      guardReasons: [],
      prerequisiteReasons: [],
      authorizationReason:
        authorization.reason || authorization.decisionCode || "ALLOWED",
      dependencyReferences: [...context.dependencyReferences],
    }),
  });
}
