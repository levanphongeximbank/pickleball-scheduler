/**
 * CORE-19 — canonical workflow completion (status → COMPLETED).
 * Does not calculate standings or validate results; those must be supplied.
 */

import { WORKFLOW_STATUS, isTerminalWorkflowStatus } from "../enums/workflowStatuses.js";
import { WORKFLOW_EVENT_TYPE } from "../enums/workflowEventTypes.js";
import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import {
  assertWorkflowDefinition,
  findWorkflowStepById,
} from "../contracts/workflowDefinition.js";
import { createWorkflowState } from "../contracts/workflowState.js";
import {
  WORKFLOW_CONTROL_OPERATION,
  createWorkflowControlRequest,
} from "../contracts/workflowControlRequest.js";
import { createWorkflowControlResult } from "../contracts/workflowControlResult.js";
import { createTransitionExplanation } from "../contracts/transitionExplanation.js";
import { composePrerequisiteResults } from "./composePrerequisiteResults.js";
import { evaluateTransitionEffects } from "./evaluateTransitionEffects.js";
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
 * @param {object} state
 * @param {object} request
 * @returns {{ allowed: boolean, targetStepId: string|null, reason: string }}
 */
function resolveCompletionPermission(definition, state, request) {
  const completionStepIds = Array.isArray(definition.metadata?.completionStepIds)
    ? definition.metadata.completionStepIds.map(String)
    : definition.steps
        .filter((s) => s.status === WORKFLOW_STATUS.COMPLETED)
        .map((s) => s.stepId);

  const payloadTarget =
    isPlainObject(request.payload) && request.payload.targetStepId != null
      ? String(request.payload.targetStepId)
      : null;

  const currentStep = findWorkflowStepById(definition, state.currentStepId);
  const currentAllows =
    currentStep?.metadata?.allowsCompletion === true ||
    currentStep?.status === WORKFLOW_STATUS.COMPLETED ||
    completionStepIds.includes(state.currentStepId);

  if (definition.metadata?.allowCompletion === true) {
    return {
      allowed: true,
      targetStepId: payloadTarget || completionStepIds[0] || state.currentStepId,
      reason: "definition.allowCompletion",
    };
  }

  if (payloadTarget) {
    if (!completionStepIds.includes(payloadTarget)) {
      return {
        allowed: false,
        targetStepId: payloadTarget,
        reason: "payload targetStepId is not a completion step",
      };
    }
    return {
      allowed: true,
      targetStepId: payloadTarget,
      reason: "payload.targetStepId",
    };
  }

  if (currentAllows) {
    return {
      allowed: true,
      targetStepId: completionStepIds[0] || state.currentStepId,
      reason: "current step permits completion",
    };
  }

  return {
    allowed: false,
    targetStepId: null,
    reason: "Current step/definition does not permit completion",
  };
}

/**
 * @param {object} input
 * @returns {Readonly<import('../contracts/workflowControlResult.js').WorkflowControlResult>}
 */
export function completeWorkflow(input = {}) {
  if (!isPlainObject(input)) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
        message: "completeWorkflow input must be a plain object",
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
      operation: WORKFLOW_CONTROL_OPERATION.COMPLETE,
    });
    context = normalizeControlContext(input.context);
  } catch (err) {
    const code =
      err && typeof err === "object" && err.code
        ? String(err.code)
        : WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION;
    return createWorkflowControlResult({
      ok: false,
      code,
      explanation: createTransitionExplanation({
        code,
        message:
          err instanceof Error ? err.message : "Invalid complete request",
      }),
    });
  }

  const duplicate = checkControlDuplicate({ request, context });
  if (duplicate.kind !== "proceed") {
    return duplicateNoopResult({ state, request, duplicate });
  }

  if (state.status === WORKFLOW_STATUS.COMPLETED) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.WORKFLOW_COMPLETED,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.WORKFLOW_COMPLETED,
        message: "Workflow is already COMPLETED",
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  if (isTerminalWorkflowStatus(state.status)) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.TRANSITION_NOT_ALLOWED,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.TRANSITION_NOT_ALLOWED,
        message: `Cannot complete from terminal status ${state.status}`,
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  const permission = resolveCompletionPermission(definition, state, request);
  if (!permission.allowed) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.TRANSITION_NOT_ALLOWED,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.TRANSITION_NOT_ALLOWED,
        message: permission.reason,
        details: {
          currentStepId: state.currentStepId,
          status: state.status,
        },
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  const composedPrereqs = composePrerequisiteResults(context.prerequisites);
  if (composedPrereqs.satisfied !== true) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
        message: "Mandatory prerequisites are not satisfied for completion",
        prerequisiteReasons: [...composedPrereqs.blockingReasons],
        details: {
          failedPrerequisiteIds: [...composedPrereqs.failedPrerequisiteIds],
        },
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  const effects = Array.isArray(input.effects) ? input.effects : [];
  if (effects.length > 0) {
    const effectEval = evaluateTransitionEffects({
      effects,
      outcomes: input.outcomes,
      effectPort: input.effectPort,
      allowOptionalEffectFailure: input.allowOptionalEffectFailure === true,
    });
    if (effectEval.canComplete !== true) {
      return createWorkflowControlResult({
        ok: false,
        code: effectEval.code || WORKFLOW_ERROR_CODE.TRANSITION_EFFECT_FAILED,
        explanation: effectEval.explanation,
        idempotencyKey: request.idempotencyKey,
        correlationId: request.correlationId,
        details: {
          failedEffectIds: [...effectEval.failedEffectIds],
          warnings: [...effectEval.warnings],
        },
      });
    }
  }

  const targetStepId = permission.targetStepId || state.currentStepId;
  const targetStep = findWorkflowStepById(definition, targetStepId);
  if (!targetStep) {
    return createWorkflowControlResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.UNKNOWN_STEP,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.UNKNOWN_STEP,
        message: `Completion target step unknown: ${targetStepId}`,
      }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
    });
  }

  const nextState = createWorkflowState({
    ...state,
    currentStepId: targetStep.stepId,
    status: WORKFLOW_STATUS.COMPLETED,
    revision: state.revision + 1,
    previousStepId: state.currentStepId,
    metadata: {
      ...state.metadata,
      completedReason: request.reason || request.reasonCode,
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
    eventType: WORKFLOW_EVENT_TYPE.WORKFLOW_COMPLETED,
    controlTransitionId: "control:complete",
    payloadFingerprint,
  });

  return createWorkflowControlResult({
    ok: true,
    code: null,
    state: nextState,
    events: [event],
    explanation: createTransitionExplanation({
      code: "WORKFLOW_COMPLETED",
      message: "Workflow completed",
      details: {
        fromStepId: state.currentStepId,
        toStepId: nextState.currentStepId,
        fromStatus: state.status,
        toStatus: nextState.status,
        warnings: [...composedPrereqs.warnings],
      },
    }),
    correlationId: request.correlationId,
    idempotencyKey: request.idempotencyKey,
    details: { payloadFingerprint: duplicate.fingerprint },
  });
}
