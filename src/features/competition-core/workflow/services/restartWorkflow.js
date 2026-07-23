/**
 * CORE-19 — restart workflow to an explicitly permitted step.
 * No CORE-23 recovery. No data reconstruction. No recovery checkpoints.
 */

import { isTerminalWorkflowStatus } from "../enums/workflowStatuses.js";
import { WORKFLOW_EVENT_TYPE } from "../enums/workflowEventTypes.js";
import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import {
  assertWorkflowDefinition,
  findWorkflowStepById,
} from "../contracts/workflowDefinition.js";
import { createWorkflowState } from "../contracts/workflowState.js";
import {
  WORKFLOW_RESTART_MODE,
  createWorkflowRestartRequest,
} from "../contracts/workflowRestartRequest.js";
import { createWorkflowControlResult } from "../contracts/workflowControlResult.js";
import { createTransitionExplanation } from "../contracts/transitionExplanation.js";
import { isPlainObject } from "../utils/canonicalizeWorkflowPayload.js";
import {
  buildControlEvent,
  checkControlDuplicate,
  duplicateNoopResult,
  fingerprintControlPayload,
  normalizeControlContext,
} from "./controlHelpers.js";

/**
 * @param {object} definition
 * @returns {{ allowed: boolean, allowedTargetStepIds: string[], allowedFromStatuses: string[]|null }}
 */
function resolveRestartPolicy(definition, context) {
  const fromDef = isPlainObject(definition.metadata?.restartPolicy)
    ? definition.metadata.restartPolicy
    : null;
  const fromCtx =
    isPlainObject(context) && isPlainObject(context.restartPolicy)
      ? context.restartPolicy
      : null;
  const policy = fromDef || fromCtx;
  if (!policy) {
    return { allowed: false, allowedTargetStepIds: [], allowedFromStatuses: null };
  }
  return {
    allowed: policy.allowed === true || policy.enabled === true,
    allowedTargetStepIds: Array.isArray(policy.allowedTargetStepIds)
      ? policy.allowedTargetStepIds.map(String)
      : Array.isArray(policy.targetStepIds)
        ? policy.targetStepIds.map(String)
        : [],
    allowedFromStatuses: Array.isArray(policy.allowedFromStatuses)
      ? policy.allowedFromStatuses.map(String)
      : null,
  };
}

/**
 * @param {object} input
 * @returns {Readonly<import('../contracts/workflowControlResult.js').WorkflowControlResult>}
 */
export function restartWorkflow(input = {}) {
  if (!isPlainObject(input)) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.INVALID_RESTART_REQUEST,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.INVALID_RESTART_REQUEST,
        message: "restartWorkflow input must be a plain object",
      }),
    });
  }

  let definition;
  let state;
  let request;
  let context;
  try {
    definition = assertWorkflowDefinition(input.definition);
    state = createWorkflowState(input.state);
    request = createWorkflowRestartRequest(input.request);
    context = normalizeControlContext(input.context);
  } catch (err) {
    const code =
      err && typeof err === "object" && err.code
        ? String(err.code)
        : WORKFLOW_ERROR_CODE.INVALID_RESTART_REQUEST;
    return createWorkflowControlResult({
      ok: false,
      code,
      explanation: createTransitionExplanation({
        code,
        message: err instanceof Error ? err.message : "Invalid restart request",
      }),
    });
  }

  const duplicate = checkControlDuplicate({ request, context });
  if (duplicate.kind !== "proceed") {
    return duplicateNoopResult({ state, request, duplicate });
  }

  const policy = resolveRestartPolicy(definition, input.context);
  if (!policy.allowed) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.RESTART_NOT_ALLOWED,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.RESTART_NOT_ALLOWED,
        message: "Restart policy is not enabled on definition or context",
        details: { recoveryInvoked: false },
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  if (
    policy.allowedFromStatuses &&
    !policy.allowedFromStatuses.includes(state.status)
  ) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.RESTART_NOT_ALLOWED,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.RESTART_NOT_ALLOWED,
        message: `Restart not allowed from status ${state.status}`,
        details: { status: state.status },
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  // Cancelled remains blocked unless policy explicitly lists it.
  if (
    state.status === "CANCELLED" &&
    !(policy.allowedFromStatuses || []).includes("CANCELLED")
  ) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.RESTART_NOT_ALLOWED,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.RESTART_NOT_ALLOWED,
        message: "Restart from CANCELLED requires explicit policy",
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  let targetStepId = request.targetStepId;
  if (request.restartMode === WORKFLOW_RESTART_MODE.INITIAL_STEP) {
    targetStepId = definition.steps[0]?.stepId || null;
  }

  if (!targetStepId) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.INVALID_RESTART_REQUEST,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.INVALID_RESTART_REQUEST,
        message: "Restart target step could not be resolved",
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  const targetStep = findWorkflowStepById(definition, targetStepId);
  if (!targetStep) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.UNKNOWN_STEP,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.UNKNOWN_STEP,
        message: `Unknown restart target step: ${targetStepId}`,
        details: { targetStepId, recoveryInvoked: false },
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  if (
    policy.allowedTargetStepIds.length > 0 &&
    !policy.allowedTargetStepIds.includes(targetStepId)
  ) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.RESTART_NOT_ALLOWED,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.RESTART_NOT_ALLOWED,
        message: `Restart target ${targetStepId} is not authorized by policy`,
        details: { targetStepId, recoveryInvoked: false },
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  const authorization = request.authorization ?? context.authorization;
  if (authorization && authorization.allowed !== true) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.TRANSITION_UNAUTHORIZED,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.TRANSITION_UNAUTHORIZED,
        message: "Restart authorization denied",
        authorizationReason:
          authorization.reason || authorization.decisionCode || "DENIED",
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  void isTerminalWorkflowStatus;

  const nextState = createWorkflowState({
    workflowInstanceId: state.workflowInstanceId,
    definitionId: state.definitionId,
    definitionVersion: state.definitionVersion,
    currentStepId: targetStep.stepId,
    status: targetStep.status,
    revision: state.revision + 1,
    restartCount: state.restartCount + 1,
    previousStepId: state.currentStepId,
    metadata: {
      ...state.metadata,
      lastRestartReason: request.reason || request.reasonCode,
      lastRestartMode: request.restartMode,
    },
  });

  const payloadFingerprint = fingerprintControlPayload({
    operation: request.operation,
    reason: request.reason,
    reasonCode: request.reasonCode,
    targetStepId,
    restartMode: request.restartMode,
    payload: request.payload,
  });

  const event = buildControlEvent({
    context,
    state,
    nextState,
    request,
    eventType: WORKFLOW_EVENT_TYPE.WORKFLOW_RESTARTED,
    controlTransitionId: "control:restart",
    payloadFingerprint,
    payload: {
      targetStepId,
      restartMode: request.restartMode,
      restartCount: nextState.restartCount,
      recoveryInvoked: false,
    },
  });

  return createWorkflowControlResult({
    ok: true,
    code: null,
    state: nextState,
    events: [event],
    explanation: createTransitionExplanation({
      code: "WORKFLOW_RESTARTED",
      message: `Workflow restarted to ${targetStepId}`,
      details: {
        fromStepId: state.currentStepId,
        toStepId: targetStepId,
        fromStatus: state.status,
        toStatus: nextState.status,
        restartCount: nextState.restartCount,
        recoveryInvoked: false,
      },
    }),
    correlationId: request.correlationId,
    idempotencyKey: request.idempotencyKey,
    details: {
      payloadFingerprint: duplicate.fingerprint,
      recoveryInvoked: false,
    },
  });
}
