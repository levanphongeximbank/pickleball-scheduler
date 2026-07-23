/**
 * CORE-19 — resume workflow (PAUSED → RUNNING).
 * Does not call CORE-15 match resume. Does not perform CORE-23 recovery.
 */

import { WORKFLOW_STATUS, isTerminalWorkflowStatus } from "../enums/workflowStatuses.js";
import { WORKFLOW_EVENT_TYPE } from "../enums/workflowEventTypes.js";
import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { assertWorkflowDefinition } from "../contracts/workflowDefinition.js";
import { createWorkflowState } from "../contracts/workflowState.js";
import { createWorkflowResumeRequest } from "../contracts/workflowResumeRequest.js";
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
export function resumeWorkflow(input = {}) {
  if (!isPlainObject(input)) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.INVALID_RESUME_REQUEST,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.INVALID_RESUME_REQUEST,
        message: "resumeWorkflow input must be a plain object",
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
    request = createWorkflowResumeRequest(input.request);
    context = normalizeControlContext(input.context);
  } catch (err) {
    const code =
      err && typeof err === "object" && err.code
        ? String(err.code)
        : WORKFLOW_ERROR_CODE.INVALID_RESUME_REQUEST;
    return createWorkflowControlResult({
      ok: false,
      code,
      explanation: createTransitionExplanation({
        code,
        message: err instanceof Error ? err.message : "Invalid resume request",
      }),
    });
  }

  const duplicate = checkControlDuplicate({ request, context });
  if (duplicate.kind !== "proceed") {
    return duplicateNoopResult({ state, request, duplicate });
  }

  if (isTerminalWorkflowStatus(state.status)) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.INVALID_RESUME_REQUEST,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.INVALID_RESUME_REQUEST,
        message: `Cannot resume from terminal status ${state.status}`,
        details: { status: state.status },
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  if (state.status !== WORKFLOW_STATUS.PAUSED) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.INVALID_RESUME_REQUEST,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.INVALID_RESUME_REQUEST,
        message: "Resume is valid only from PAUSED",
        details: { status: state.status },
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
        message: "Resume authorization denied",
        authorizationReason:
          authorization.reason || authorization.decisionCode || "DENIED",
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  const nextState = createWorkflowState({
    ...state,
    status: WORKFLOW_STATUS.RUNNING,
    revision: state.revision + 1,
    previousStepId: state.currentStepId,
    metadata: {
      ...state.metadata,
      lastResumeReason: request.reason || request.reasonCode,
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
    eventType: WORKFLOW_EVENT_TYPE.WORKFLOW_RESUMED,
    controlTransitionId: "control:resume",
    payloadFingerprint,
  });

  return createWorkflowControlResult({
    ok: true,
    code: null,
    state: nextState,
    events: [event],
    explanation: createTransitionExplanation({
      code: "WORKFLOW_RESUMED",
      message: "Workflow resumed",
      details: {
        fromStatus: state.status,
        toStatus: nextState.status,
        currentStepId: state.currentStepId,
        definitionId: definition.definitionId,
      },
      authorizationReason:
        authorization?.reason || authorization?.decisionCode || null,
    }),
    correlationId: request.correlationId,
    idempotencyKey: request.idempotencyKey,
    details: { payloadFingerprint: duplicate.fingerprint },
  });
}
