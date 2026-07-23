/**
 * CORE-19 — transition context (deterministic inputs only).
 * occurredAt and eventId must be supplied; kernel never invents wall-clock or random ids.
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { WorkflowError } from "../errors/WorkflowError.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";
import {
  createTransitionAuthorizationDecision,
  createTransitionGuardDecision,
  createTransitionPrerequisiteResult,
} from "./workflowDecisions.js";

/**
 * @typedef {Object} WorkflowTransitionContext
 * @property {string} occurredAt
 * @property {string|null} [eventId]
 * @property {(parts: Record<string, unknown>) => string} [eventIdFactory]
 * @property {string|null} [actorId]
 * @property {string|null} [actorType]
 * @property {Readonly<import('./workflowDecisions.js').TransitionAuthorizationDecision>|null} [authorization]
 * @property {ReadonlyArray<import('./workflowDecisions.js').TransitionPrerequisiteResult>} [prerequisites]
 * @property {ReadonlyArray<import('./workflowDecisions.js').TransitionGuardDecision>} [guards]
 * @property {ReadonlyArray<string>} [seenIdempotencyKeys]
 * @property {Readonly<Record<string, unknown>>} [payload]
 * @property {ReadonlyArray<string>} [dependencyReferences]
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function requireOccurredAt(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (isNonEmptyString(value)) {
    const raw = String(value).trim();
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return raw;
  }
  throw new WorkflowError(
    WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
    "occurredAt must be supplied through transition context",
    {}
  );
}

/**
 * @param {unknown} partial
 * @returns {Readonly<WorkflowTransitionContext>}
 */
export function createWorkflowTransitionContext(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "WorkflowTransitionContext must be a plain object",
      {}
    );
  }

  const occurredAt = requireOccurredAt(partial.occurredAt);
  const eventId = isNonEmptyString(partial.eventId)
    ? String(partial.eventId).trim()
    : null;
  const eventIdFactory =
    typeof partial.eventIdFactory === "function"
      ? partial.eventIdFactory
      : null;

  if (!eventId && !eventIdFactory) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "eventId or eventIdFactory must be supplied through transition context",
      {}
    );
  }

  const prerequisites = Array.isArray(partial.prerequisites)
    ? partial.prerequisites.map((p) => createTransitionPrerequisiteResult(p))
    : [];
  const guards = Array.isArray(partial.guards)
    ? partial.guards.map((g) => createTransitionGuardDecision(g))
    : [];
  const seenIdempotencyKeys = Array.isArray(partial.seenIdempotencyKeys)
    ? partial.seenIdempotencyKeys.map((k) => String(k))
    : [];
  const dependencyReferences = Array.isArray(partial.dependencyReferences)
    ? partial.dependencyReferences.map((r) => String(r))
    : [];

  return Object.freeze({
    occurredAt,
    eventId,
    eventIdFactory,
    actorId:
      partial.actorId == null || partial.actorId === ""
        ? null
        : String(partial.actorId),
    actorType:
      partial.actorType == null || partial.actorType === ""
        ? null
        : String(partial.actorType),
    authorization:
      partial.authorization == null
        ? null
        : createTransitionAuthorizationDecision(partial.authorization),
    prerequisites: Object.freeze([...prerequisites]),
    guards: Object.freeze([...guards]),
    seenIdempotencyKeys: Object.freeze([...seenIdempotencyKeys]),
    payload: Object.freeze(
      /** @type {Record<string, unknown>} */ (
        deepFreezeClone(isPlainObject(partial.payload) ? partial.payload : {})
      )
    ),
    dependencyReferences: Object.freeze([...dependencyReferences]),
  });
}

/**
 * @param {unknown} value
 * @returns {Readonly<WorkflowTransitionContext>}
 */
export function assertWorkflowTransitionContext(value) {
  return createWorkflowTransitionContext(value);
}
