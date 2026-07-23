/**
 * CORE-19 — pause workflow (RUNNING → PAUSED by default).
 * Workflow-level only; does not pause CORE-15 match lifecycle.
 */

import { WORKFLOW_STATUS, isTerminalWorkflowStatus } from "../enums/workflowStatuses.js";
import { WORKFLOW_EVENT_TYPE } from "../enums/workflowEventTypes.js";
import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { assertWorkflowDefinition } from "../contracts/workflowDefinition.js";
import { createWorkflowState } from "../contracts/workflowState.js";
import {
  WORKFLOW_CONTROL_OPERATION,
  createWorkflowControlRequest,
} from "../contracts/workflowControlRequest.js";
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
 * @param {object} input
 * @returns {Readonly<import('../contracts/workflowControlResult.js').WorkflowControlResult>}
 */
export function pauseWorkflow(input = {}) {
  if (!isPlainObject(input)) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.INVALID_PAUSE_REQUEST,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.INVALID_PAUSE_REQUEST,
        message: "pauseWorkflow input must be a plain object",
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
    request = createWorkflowControlRequest({
      ...(isPlainObject(input.request) ? input.request : {}),
      operation: WORKFLOW_CONTROL_OPERATION.PAUSE,
    });
    context = normalizeControlContext(input.context);
  } catch (err) {
    const code =
      err && typeof err === "object" && err.code
        ? String(err.code)
        : WORKFLOW_ERROR_CODE.INVALID_PAUSE_REQUEST;
    return createWorkflowControlResult({
      ok: false,
      code,
      explanation: createTransitionExplanation({
        code,
        message: err instanceof Error ? err.message : "Invalid pause request",
      }),
    });
  }

  if (
    request.workflowInstanceId != null &&
    request.workflowInstanceId !== state.workflowInstanceId
  ) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.UNKNOWN_WORKFLOW,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.UNKNOWN_WORKFLOW,
        message: "Request workflowInstanceId does not match state",
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  const duplicate = checkControlDuplicate({ request, context });
  if (duplicate.kind !== "proceed") {
    return duplicateNoopResult({ state, request, duplicate });
  }

  if (isTerminalWorkflowStatus(state.status)) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.INVALID_PAUSE_REQUEST,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.INVALID_PAUSE_REQUEST,
        message: `Cannot pause terminal workflow status ${state.status}`,
        details: { status: state.status },
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  const allowedFrom = Array.isArray(definition.metadata?.pauseFromStatuses)
    ? definition.metadata.pauseFromStatuses.map(String)
    : [WORKFLOW_STATUS.RUNNING];

  if (!allowedFrom.includes(state.status)) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.INVALID_PAUSE_REQUEST,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.INVALID_PAUSE_REQUEST,
        message: `Pause not allowed from status ${state.status}`,
        details: { status: state.status, allowedFrom },
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  if (!request.reason && !request.reasonCode) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.INVALID_PAUSE_REQUEST,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.INVALID_PAUSE_REQUEST,
        message: "Pause requires reason or reasonCode",
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  const nextState = createWorkflowState({
    ...state,
    status: WORKFLOW_STATUS.PAUSED,
    revision: state.revision + 1,
    previousStepId: state.currentStepId,
    metadata: {
      ...state.metadata,
      lastPauseReason: request.reason || request.reasonCode,
    },
  });

  const payloadFingerprint = fingerprintControlPayload({
    operation: request.operation,
    reason: request.reason,
    reasonCode: request.reasonCode,
    payload: request.payload,
  });

  const event = buildControlEvent({
    context,
    state,
    nextState,
    request,
    eventType: WORKFLOW_EVENT_TYPE.WORKFLOW_PAUSED,
    controlTransitionId: "control:pause",
    payloadFingerprint,
  });

  return createWorkflowControlResult({
    ok: true,
    code: null,
    state: nextState,
    events: [event],
    explanation: createTransitionExplanation({
      code: "WORKFLOW_PAUSED",
      message: "Workflow paused",
      details: {
        fromStatus: state.status,
        toStatus: nextState.status,
        currentStepId: state.currentStepId,
        reason: request.reason || request.reasonCode,
      },
    }),
    correlationId: request.correlationId,
    idempotencyKey: request.idempotencyKey,
    details: {
      definitionId: definition.definitionId,
      payloadFingerprint: duplicate.fingerprint,
    },
  });
}
