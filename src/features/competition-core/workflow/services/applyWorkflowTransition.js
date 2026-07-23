/**
 * CORE-19 — apply approved workflow transition (pure, immutable).
 * Never mutates inputs. Never persists. Never invokes external effects.
 * Never calls dependency engines directly. Never invents wall-clock or random ids.
 */

import { WORKFLOW_STATUS } from "../enums/workflowStatuses.js";
import { WORKFLOW_EVENT_TYPE } from "../enums/workflowEventTypes.js";
import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { WorkflowError } from "../errors/WorkflowError.js";
import {
  assertWorkflowDefinition,
  findWorkflowTransitionById,
} from "../contracts/workflowDefinition.js";
import { createWorkflowState } from "../contracts/workflowState.js";
import { createWorkflowTransitionRequest } from "../contracts/workflowTransitionRequest.js";
import { createWorkflowTransitionContext } from "../contracts/workflowTransitionContext.js";
import {
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

/**
 * @param {object} args
 * @returns {string}
 */
function resolveEventId(args) {
  const { context, baseParts, sequence } = args;
  if (typeof context.eventIdFactory === "function") {
    return String(
      context.eventIdFactory({
        ...baseParts,
        sequence,
      })
    );
  }
  if (context.eventId && sequence === 1) {
    return String(context.eventId);
  }
  if (context.eventId) {
    return `${context.eventId}:${sequence}`;
  }
  throw new WorkflowError(
    WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
    "eventId or eventIdFactory must be supplied through transition context",
    { sequence }
  );
}

/**
 * @param {object} args
 * @returns {ReadonlyArray<import('../contracts/workflowEvent.js').WorkflowEvent>}
 */
function buildSuccessEvents(args) {
  const {
    definition,
    state,
    nextState,
    transition,
    request,
    context,
    payloadFingerprint,
  } = args;

  const actorId = context.actorId ?? context.authorization?.actorId ?? null;
  const actorType =
    context.actorType ?? context.authorization?.actorType ?? null;

  const baseParts = {
    workflowInstanceId: state.workflowInstanceId,
    definitionId: definition.definitionId,
    definitionVersion: definition.definitionVersion,
    transitionId: transition.transitionId,
    fromStepId: state.currentStepId,
    toStepId: transition.toStepId,
    fromStatus: state.status,
    toStatus: transition.toStatus,
    occurredAt: context.occurredAt,
    idempotencyKey: request.idempotencyKey,
    correlationId: request.correlationId,
    actorId,
    actorType,
    reasonCode: request.reasonCode,
    payloadFingerprint,
    payload: {
      ...context.payload,
      ...request.payload,
    },
  };

  /** @type {string[]} */
  const types = [
    WORKFLOW_EVENT_TYPE.TRANSITION_AUTHORIZED,
    WORKFLOW_EVENT_TYPE.TRANSITION_STARTED,
    WORKFLOW_EVENT_TYPE.TRANSITION_COMPLETED,
  ];

  if (transition.toStatus === WORKFLOW_STATUS.PAUSED) {
    types.push(WORKFLOW_EVENT_TYPE.WORKFLOW_PAUSED);
  }
  if (transition.toStatus === WORKFLOW_STATUS.COMPLETED) {
    types.push(WORKFLOW_EVENT_TYPE.WORKFLOW_COMPLETED);
  }

  return types.map((eventType, index) =>
    createWorkflowEvent({
      ...baseParts,
      eventType,
      eventId: resolveEventId({
        context,
        baseParts: { ...baseParts, eventType },
        sequence: index + 1,
      }),
      fromStatus: state.status,
      toStatus: nextState.status,
      fromStepId: state.currentStepId,
      toStepId: nextState.currentStepId,
    })
  );
}

/**
 * Apply a workflow transition using an approved evaluation, or re-evaluate.
 *
 * @param {object} input
 * @param {unknown} input.definition
 * @param {unknown} input.state
 * @param {unknown} input.request
 * @param {unknown} input.context
 * @param {unknown} [input.evaluation]
 * @returns {Readonly<import('../contracts/workflowTransitionResult.js').WorkflowTransitionResult>}
 */
export function applyWorkflowTransition(input = {}) {
  if (!isPlainObject(input)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "applyWorkflowTransition input must be a plain object",
      {}
    );
  }

  const definition = assertWorkflowDefinition(input.definition);
  const state = createWorkflowState(input.state);
  const request = createWorkflowTransitionRequest(input.request);
  const context = createWorkflowTransitionContext(input.context);

  // Canonical fingerprint duplicate policy (same as orchestrate/control).
  // seenIdempotencyKeys without fingerprints remain Phase 1B evaluate deny path.
  const duplicate = resolveDuplicateOperation({
    idempotencyKey: request.idempotencyKey,
    operation: "TRANSITION",
    payload: {
      transitionId: request.transitionId,
      ...(isPlainObject(request.payload) ? request.payload : {}),
      ...(isPlainObject(context.payload) ? context.payload : {}),
    },
    processedOperations:
      input.processedOperations || context.payload?.processedOperations,
  });

  if (duplicate.kind === "noop") {
    return createWorkflowTransitionResult({
      ok: true,
      state,
      events: [],
      explanation: createTransitionExplanation({
        code: "DUPLICATE_OPERATION_NOOP",
        message:
          "Identical transition idempotency key and payload; deterministic no-op",
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

  // Pre-approved evaluation must not bypass Phase 1B key-only duplicate deny.
  if (context.seenIdempotencyKeys.includes(request.idempotencyKey)) {
    const evaluation = createWorkflowEvaluationResult({
      ok: false,
      approved: false,
      code: WORKFLOW_ERROR_CODE.DUPLICATE_TRANSITION_REQUEST,
      transitionId: request.transitionId,
      explanation: createTransitionExplanation({
        code: WORKFLOW_ERROR_CODE.DUPLICATE_TRANSITION_REQUEST,
        message: "Duplicate idempotency key for transition request",
        details: { idempotencyKey: request.idempotencyKey },
      }),
    });
    return createWorkflowTransitionResult({
      ok: false,
      state: null,
      events: [],
      explanation: evaluation.explanation,
      evaluation,
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
      code: WORKFLOW_ERROR_CODE.DUPLICATE_TRANSITION_REQUEST,
    });
  }

  let evaluation = input.evaluation
    ? createWorkflowEvaluationResult(input.evaluation)
    : null;

  if (!evaluation || evaluation.approved !== true || evaluation.ok !== true) {
    evaluation = evaluateWorkflowTransition({
      definition,
      state,
      request,
      context,
    });
  }

  if (!evaluation.approved || !evaluation.ok) {
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
  if (!transition) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.UNKNOWN_TRANSITION,
      "Approved evaluation references unknown transition",
      { transitionId: evaluation.transitionId }
    );
  }

  const nextState = createWorkflowState({
    workflowInstanceId: state.workflowInstanceId,
    definitionId: state.definitionId,
    definitionVersion: state.definitionVersion,
    currentStepId: transition.toStepId,
    status: transition.toStatus,
    revision: state.revision + 1,
    restartCount: state.restartCount,
    previousStepId: state.currentStepId,
    metadata: state.metadata,
  });

  const mergedPayload = {
    ...context.payload,
    ...request.payload,
  };
  const payloadFingerprint = createWorkflowPayloadFingerprint(mergedPayload);

  const events = buildSuccessEvents({
    definition,
    state,
    nextState,
    transition,
    request,
    context,
    payloadFingerprint,
  });

  const explanation = createTransitionExplanation({
    code: "TRANSITION_APPLIED",
    message: `Transition ${transition.transitionId} applied`,
    details: {
      fromStepId: state.currentStepId,
      toStepId: nextState.currentStepId,
      fromStatus: state.status,
      toStatus: nextState.status,
      revision: nextState.revision,
      eventCount: events.length,
    },
    guardReasons: [],
    prerequisiteReasons: [],
    authorizationReason: evaluation.explanation.authorizationReason,
    dependencyReferences: evaluation.explanation.dependencyReferences,
  });

  return createWorkflowTransitionResult({
    ok: true,
    state: nextState,
    events,
    explanation,
    evaluation,
    correlationId: request.correlationId,
    idempotencyKey: request.idempotencyKey,
    code: null,
  });
}
