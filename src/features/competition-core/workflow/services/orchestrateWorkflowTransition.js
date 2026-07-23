/**
 * CORE-19 — higher-level pure orchestration for transition + supplied effects.
 *
 * Preserves Phase 1B/1C applyWorkflowTransition API (no external effect execution).
 * Flow:
 * 1. evaluateWorkflowTransition
 * 2. evaluate supplied effect outcomes
 * 3. apply workflow transition only if required effects permit
 * 4. produce next immutable state + deterministic events
 */

import { WORKFLOW_EVENT_TYPE } from "../enums/workflowEventTypes.js";
import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import {
  assertWorkflowDefinition,
  findWorkflowTransitionById,
} from "../contracts/workflowDefinition.js";
import { createWorkflowState } from "../contracts/workflowState.js";
import { createWorkflowTransitionRequest } from "../contracts/workflowTransitionRequest.js";
import { createWorkflowTransitionContext } from "../contracts/workflowTransitionContext.js";
import {
  buildWorkflowEventId,
  createWorkflowEvent,
} from "../contracts/workflowEvent.js";
import { createTransitionExplanation } from "../contracts/transitionExplanation.js";
import {
  createWorkflowEvaluationResult,
  createWorkflowTransitionResult,
} from "../contracts/workflowTransitionResult.js";
import {
  createWorkflowPayloadFingerprint,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";
import { resolveDuplicateOperation } from "../utils/resolveDuplicateOperation.js";
import { evaluateWorkflowTransition } from "./evaluateWorkflowTransition.js";
import { evaluateTransitionEffects } from "./evaluateTransitionEffects.js";
import { applyWorkflowTransition } from "./applyWorkflowTransition.js";

/**
 * @param {object} input
 * @returns {Readonly<import('../contracts/workflowTransitionResult.js').WorkflowTransitionResult>}
 */
export function orchestrateWorkflowTransition(input = {}) {
  if (!isPlainObject(input)) {
    return createWorkflowTransitionResult({
      ok: false,
      code: WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
        message: "orchestrateWorkflowTransition input must be a plain object",
      }),
    });
  }

  const definition = assertWorkflowDefinition(input.definition);
  const state = createWorkflowState(input.state);
  const request = createWorkflowTransitionRequest(input.request);
  const context = createWorkflowTransitionContext(input.context);

  const duplicate = resolveDuplicateOperation({
    idempotencyKey: request.idempotencyKey,
    operation: "TRANSITION",
    payload: {
      transitionId: request.transitionId,
      ...(isPlainObject(request.payload) ? request.payload : {}),
      ...(isPlainObject(context.payload) ? context.payload : {}),
    },
    processedOperations: input.processedOperations || context.payload?.processedOperations,
    seenIdempotencyKeys: context.seenIdempotencyKeys,
  });

  if (duplicate.kind === "noop") {
    return createWorkflowTransitionResult({
      ok: true,
      state,
      events: [],
      explanation: createTransitionExplanation({
        code: "DUPLICATE_OPERATION_NOOP",
        message: "Identical transition idempotency key and payload; deterministic no-op",
        details: duplicate.details,
      }),
      evaluation: createWorkflowEvaluationResult({
        ok: true,
        approved: true,
        code: null,
        transitionId: request.transitionId,
        details: { duplicate: true, noop: true },
      }),
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
      code: null,
    });
  }

  if (duplicate.kind === "conflict") {
    return createWorkflowTransitionResult({
      ok: false,
      state: null,
      events: [],
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
        message: "Idempotency key reused with a different canonical payload",
        details: duplicate.details,
      }),
      evaluation: createWorkflowEvaluationResult({
        ok: false,
        approved: false,
        code: WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
        transitionId: request.transitionId,
      }),
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
      code: WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
    });
  }

  const evaluation = evaluateWorkflowTransition({
    definition,
    state,
    request,
    context,
  });

  if (!evaluation.ok || !evaluation.approved) {
    return createWorkflowTransitionResult({
      ok: false,
      state: null,
      events: [],
      explanation: evaluation.explanation,
      evaluation,
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
      code: evaluation.code,
    });
  }

  const transition = findWorkflowTransitionById(
    definition,
    evaluation.transitionId || request.transitionId
  );
  const effectDescriptors = Array.isArray(input.effects)
    ? input.effects
    : transition?.effects || [];

  const allowOptionalEffectFailure =
    input.allowOptionalEffectFailure === true ||
    transition?.allowOptionalEffectFailure === true;

  const effectsEvaluation = evaluateTransitionEffects({
    effects: effectDescriptors,
    outcomes: input.outcomes,
    effectPort: input.effectPort,
    allowOptionalEffectFailure,
    context,
  });

  if (effectsEvaluation.canComplete !== true) {
    const payloadFingerprint = createWorkflowPayloadFingerprint({
      ...context.payload,
      ...request.payload,
      failedEffectIds: effectsEvaluation.failedEffectIds,
    });

    const baseParts = {
      eventType: WORKFLOW_EVENT_TYPE.TRANSITION_FAILED,
      workflowInstanceId: state.workflowInstanceId,
      definitionId: definition.definitionId,
      definitionVersion: definition.definitionVersion,
      transitionId: request.transitionId,
      fromStepId: state.currentStepId,
      toStepId: transition?.toStepId || state.currentStepId,
      fromStatus: state.status,
      toStatus: state.status,
      occurredAt: context.occurredAt,
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
      actorId: context.actorId,
      actorType: context.actorType,
      reasonCode: request.reasonCode,
      payloadFingerprint,
    };

    const failedEvent = createWorkflowEvent({
      ...baseParts,
      eventId:
        context.eventId ||
        buildWorkflowEventId({ ...baseParts, sequence: 1 }),
      payload: {
        failedEffectIds: [...effectsEvaluation.failedEffectIds],
        warnings: [...effectsEvaluation.warnings],
        code: effectsEvaluation.code,
      },
    });

    return createWorkflowTransitionResult({
      ok: false,
      state: null,
      events: [failedEvent],
      explanation: createTransitionExplanation({
        code: effectsEvaluation.code || WORKFLOW_ERROR_CODE.TRANSITION_EFFECT_FAILED,
        message: "Required transition effects failed; transition not applied",
        details: {
          failedEffectIds: [...effectsEvaluation.failedEffectIds],
          warnings: [...effectsEvaluation.warnings],
          effectResults: effectsEvaluation.results,
        },
        dependencyReferences: effectsEvaluation.results
          .map((r) => r.dependencyCode)
          .filter(Boolean),
      }),
      evaluation: createWorkflowEvaluationResult({
        ...evaluation,
        ok: false,
        approved: false,
        code: effectsEvaluation.code || WORKFLOW_ERROR_CODE.TRANSITION_EFFECT_FAILED,
        details: {
          ...evaluation.details,
          effects: effectsEvaluation,
        },
      }),
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
      code: effectsEvaluation.code || WORKFLOW_ERROR_CODE.TRANSITION_EFFECT_FAILED,
    });
  }

  const applied = applyWorkflowTransition({
    definition,
    state,
    request,
    context,
    evaluation,
  });

  if (!applied.ok) return applied;

  if (effectsEvaluation.warnings.length > 0) {
    return createWorkflowTransitionResult({
      ...applied,
      explanation: createTransitionExplanation({
        ...applied.explanation,
        details: {
          ...applied.explanation.details,
          effectWarnings: [...effectsEvaluation.warnings],
        },
      }),
    });
  }

  return applied;
}
