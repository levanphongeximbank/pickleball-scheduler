/**
 * Shared helpers for workflow control services (pure).
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { WorkflowError } from "../errors/WorkflowError.js";
import { createWorkflowEvent } from "../contracts/workflowEvent.js";
import { createTransitionExplanation } from "../contracts/transitionExplanation.js";
import { createWorkflowControlResult } from "../contracts/workflowControlResult.js";
import {
  createWorkflowPayloadFingerprint,
  isNonEmptyString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";
import { resolveDuplicateOperation } from "../utils/resolveDuplicateOperation.js";

/**
 * @param {unknown} context
 * @returns {{ occurredAt: string, eventId: string|null, eventIdFactory: Function|null, actorId: string|null, actorType: string|null, processedOperations: unknown, seenIdempotencyKeys: unknown }}
 */
export function normalizeControlContext(context) {
  const source = isPlainObject(context) ? context : {};
  const occurredAt = isNonEmptyString(source.occurredAt)
    ? String(source.occurredAt).trim()
    : "";
  if (!occurredAt) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "occurredAt must be supplied through control context",
      {}
    );
  }
  const eventId = isNonEmptyString(source.eventId)
    ? String(source.eventId).trim()
    : null;
  const eventIdFactory =
    typeof source.eventIdFactory === "function" ? source.eventIdFactory : null;
  if (!eventId && !eventIdFactory) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "eventId or eventIdFactory must be supplied through control context",
      {}
    );
  }
  return {
    occurredAt,
    eventId,
    eventIdFactory,
    actorId:
      source.actorId == null || source.actorId === ""
        ? null
        : String(source.actorId),
    actorType:
      source.actorType == null || source.actorType === ""
        ? null
        : String(source.actorType),
    processedOperations: source.processedOperations,
    seenIdempotencyKeys: source.seenIdempotencyKeys,
    authorization: source.authorization ?? null,
    prerequisites: Array.isArray(source.prerequisites)
      ? source.prerequisites
      : [],
  };
}

/**
 * @param {object} args
 * @returns {string}
 */
export function resolveControlEventId(args) {
  const { context, baseParts, sequence = 1 } = args;
  if (typeof context.eventIdFactory === "function") {
    return String(context.eventIdFactory({ ...baseParts, sequence }));
  }
  if (context.eventId && sequence === 1) return String(context.eventId);
  if (context.eventId) return `${context.eventId}:${sequence}`;
  throw new WorkflowError(
    WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
    "eventId or eventIdFactory must be supplied through control context",
    { sequence }
  );
}

/**
 * @param {object} args
 * @returns {Readonly<object>}
 */
export function buildControlEvent(args) {
  const {
    context,
    state,
    nextState,
    request,
    eventType,
    controlTransitionId,
    payloadFingerprint,
    sequence = 1,
    payload = {},
  } = args;

  const actorId = request.actorId ?? context.actorId ?? null;
  const actorType = request.actorType ?? context.actorType ?? null;
  const fromStepId = state.currentStepId;
  const toStepId = nextState?.currentStepId ?? state.currentStepId;
  const fromStatus = state.status;
  const toStatus = nextState?.status ?? state.status;
  const transitionId = controlTransitionId;

  const baseParts = {
    eventType,
    workflowInstanceId: state.workflowInstanceId,
    definitionId: state.definitionId,
    definitionVersion: state.definitionVersion,
    transitionId,
    fromStepId,
    toStepId,
    fromStatus,
    toStatus,
    occurredAt: context.occurredAt,
    idempotencyKey: request.idempotencyKey,
    correlationId: request.correlationId,
    actorId,
    actorType,
    reasonCode: request.reasonCode,
    payloadFingerprint,
  };

  return createWorkflowEvent({
    ...baseParts,
    eventId: resolveControlEventId({ context, baseParts, sequence }),
    payload: {
      ...payload,
      reason: request.reason ?? null,
      operation: request.operation,
    },
  });
}

/**
 * @param {object} args
 * @returns {ReturnType<typeof resolveDuplicateOperation>}
 */
export function checkControlDuplicate(args) {
  return resolveDuplicateOperation({
    idempotencyKey: args.request.idempotencyKey,
    operation: args.request.operation,
    payload: {
      ...(isPlainObject(args.request.payload) ? args.request.payload : {}),
      reason: args.request.reason ?? null,
      reasonCode: args.request.reasonCode ?? null,
      targetStepId: args.request.targetStepId ?? null,
      restartMode: args.request.restartMode ?? null,
    },
    processedOperations: args.context.processedOperations,
    seenIdempotencyKeys: args.context.seenIdempotencyKeys,
  });
}

/**
 * @param {object} args
 * @returns {Readonly<import('../contracts/workflowControlResult.js').WorkflowControlResult>}
 */
export function duplicateNoopResult(args) {
  const { state, request, duplicate, code } = args;
  if (duplicate.kind === "noop") {
    return createWorkflowControlResult({
      ok: true,
      duplicate: true,
      noop: true,
      code: null,
      state,
      events: [],
      explanation: createTransitionExplanation({
        code: "DUPLICATE_OPERATION_NOOP",
        message: "Identical idempotency key and payload; deterministic no-op",
        details: duplicate.details,
      }),
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
      details: duplicate.details,
    });
  }
  return createWorkflowControlResult({
    ok: false,
    duplicate: true,
    noop: false,
    code: code || duplicate.code || WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
    state: null,
    events: [],
    explanation: createTransitionExplanation({
      code:
        code ||
        duplicate.code ||
        WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      message: "Idempotency key reused with a different canonical payload",
      details: duplicate.details,
    }),
    correlationId: request.correlationId,
    idempotencyKey: request.idempotencyKey,
    details: duplicate.details,
  });
}

/**
 * @param {unknown} payload
 * @returns {string}
 */
export function fingerprintControlPayload(payload) {
  return createWorkflowPayloadFingerprint(
    isPlainObject(payload) ? payload : {}
  );
}
