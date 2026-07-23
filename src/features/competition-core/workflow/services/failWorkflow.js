/**
 * CORE-19 — explicit workflow failure (status → FAILED).
 * Distinct from denied transition / failed prerequisite / failed guard / failed effect.
 * No recovery execution.
 */

import { WORKFLOW_STATUS, isTerminalWorkflowStatus } from "../enums/workflowStatuses.js";
import { WORKFLOW_EVENT_TYPE } from "../enums/workflowEventTypes.js";
import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { WorkflowError } from "../errors/WorkflowError.js";
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
export function failWorkflow(input = {}) {
  if (!isPlainObject(input)) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
        message: "failWorkflow input must be a plain object",
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
      operation: WORKFLOW_CONTROL_OPERATION.FAIL,
    });
    context = normalizeControlContext(input.context);
  } catch (err) {
    const code =
      err instanceof WorkflowError
        ? err.code
        : err && typeof err === "object" && err.code
          ? String(err.code)
          : WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION;
    return createWorkflowControlResult({
      ok: false,
      code,
      explanation: createTransitionExplanation({
        code,
        message: err instanceof Error ? err.message : "Invalid fail request",
      }),
    });
  }

  if (!request.reason && !request.reasonCode) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
        message: "Workflow failure requires reason or reasonCode",
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
      code: WORKFLOW_ERROR_CODE.TRANSITION_NOT_ALLOWED,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.TRANSITION_NOT_ALLOWED,
        message: `Cannot fail terminal workflow status ${state.status}`,
        details: { status: state.status },
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  const failureCode =
    (isPlainObject(request.payload) && request.payload.errorCode
      ? String(request.payload.errorCode)
      : null) ||
    request.reasonCode ||
    WORKFLOW_ERROR_CODE.WORKFLOW_FAILED;

  const nextState = createWorkflowState({
    ...state,
    status: WORKFLOW_STATUS.FAILED,
    revision: state.revision + 1,
    previousStepId: state.currentStepId,
    metadata: {
      ...state.metadata,
      failureReason: request.reason || request.reasonCode,
      failureCode,
      failedFromStepId: state.currentStepId,
      failedFromStatus: state.status,
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
    eventType: WORKFLOW_EVENT_TYPE.WORKFLOW_FAILED,
    controlTransitionId: "control:fail",
    payloadFingerprint,
    payload: {
      failureCode,
      previousStepId: state.currentStepId,
      previousStatus: state.status,
    },
  });

  return createWorkflowControlResult({
    ok: true,
    code: failureCode,
    state: nextState,
    events: [event],
    explanation: createTransitionExplanation({
      code: WORKFLOW_ERROR_CODE.WORKFLOW_FAILED,
      message: request.reason || "Workflow failed",
      details: {
        failureCode,
        previousStepId: state.currentStepId,
        previousStatus: state.status,
        definitionId: definition.definitionId,
        correlationId: request.correlationId,
      },
    }),
    correlationId: request.correlationId,
    idempotencyKey: request.idempotencyKey,
    details: {
      payloadFingerprint: duplicate.fingerprint,
      failureKind: "WORKFLOW_FAILED",
      notTransitionDenial: true,
      notPrerequisiteFailure: true,
      notGuardFailure: true,
      notEffectFailure: true,
    },
  });
}
