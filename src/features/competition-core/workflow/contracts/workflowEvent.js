/**
 * CORE-19 — workflow domain event contract (identity-complete for future CORE-20).
 * No audit persistence. No database writes.
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { WorkflowError } from "../errors/WorkflowError.js";
import { isWorkflowEventType } from "../enums/workflowEventTypes.js";
import { isWorkflowStatus } from "../enums/workflowStatuses.js";
import {
  createWorkflowPayloadFingerprint,
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";

/**
 * @typedef {Object} WorkflowEvent
 * @property {string} eventId
 * @property {string} eventType
 * @property {string} occurredAt
 * @property {string} workflowInstanceId
 * @property {string} definitionId
 * @property {string} definitionVersion
 * @property {string} transitionId
 * @property {string} fromStepId
 * @property {string} toStepId
 * @property {string} fromStatus
 * @property {string} toStatus
 * @property {string|null} actorId
 * @property {string|null} actorType
 * @property {string} idempotencyKey
 * @property {string|null} correlationId
 * @property {string|null} reasonCode
 * @property {string} payloadFingerprint
 * @property {Readonly<Record<string, unknown>>} [payload]
 */

/**
 * Deterministic event id helper for callers/factories (no nondeterministic generators).
 * createWorkflowEvent never invents an eventId — callers must supply one (often via this helper).
 * @param {Record<string, unknown>} parts
 * @returns {string}
 */
export function buildWorkflowEventId(parts = {}) {
  const segments = [
    String(parts.eventType || ""),
    String(parts.workflowInstanceId || ""),
    String(parts.transitionId || ""),
    String(parts.fromStepId || ""),
    String(parts.toStepId || ""),
    String(parts.fromStatus || ""),
    String(parts.toStatus || ""),
    String(parts.occurredAt || ""),
    String(parts.idempotencyKey || ""),
    String(parts.correlationId || ""),
    String(parts.sequence || "1"),
  ];
  return `workflow-event:${segments.join("|")}`;
}

/**
 * @param {unknown} partial
 * @returns {Readonly<WorkflowEvent>}
 */
export function createWorkflowEvent(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "WorkflowEvent must be a plain object",
      {}
    );
  }

  const eventType = isNonEmptyString(partial.eventType)
    ? String(partial.eventType).trim()
    : "";
  if (!isWorkflowEventType(eventType)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "Invalid workflow event type",
      { eventType: partial.eventType }
    );
  }

  const occurredAt = isNonEmptyString(partial.occurredAt)
    ? String(partial.occurredAt).trim()
    : "";
  if (!occurredAt) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "occurredAt is required on WorkflowEvent",
      {}
    );
  }

  const workflowInstanceId = isNonEmptyString(partial.workflowInstanceId)
    ? String(partial.workflowInstanceId).trim()
    : "";
  const definitionId = isNonEmptyString(partial.definitionId)
    ? String(partial.definitionId).trim()
    : "";
  const definitionVersion = isNonEmptyString(partial.definitionVersion)
    ? String(partial.definitionVersion).trim()
    : "";
  const transitionId = isNonEmptyString(partial.transitionId)
    ? String(partial.transitionId).trim()
    : "";
  const fromStepId = isNonEmptyString(partial.fromStepId)
    ? String(partial.fromStepId).trim()
    : "";
  const toStepId = isNonEmptyString(partial.toStepId)
    ? String(partial.toStepId).trim()
    : "";
  const fromStatus = isNonEmptyString(partial.fromStatus)
    ? String(partial.fromStatus).trim().toUpperCase()
    : "";
  const toStatus = isNonEmptyString(partial.toStatus)
    ? String(partial.toStatus).trim().toUpperCase()
    : "";
  const idempotencyKey = isNonEmptyString(partial.idempotencyKey)
    ? String(partial.idempotencyKey).trim()
    : "";

  if (
    !workflowInstanceId ||
    !definitionId ||
    !definitionVersion ||
    !transitionId ||
    !fromStepId ||
    !toStepId ||
    !idempotencyKey
  ) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "WorkflowEvent identity fields are incomplete",
      {
        workflowInstanceId,
        definitionId,
        definitionVersion,
        transitionId,
        fromStepId,
        toStepId,
        idempotencyKey,
      }
    );
  }
  if (!isWorkflowStatus(fromStatus) || !isWorkflowStatus(toStatus)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "fromStatus and toStatus must be CORE-19 WORKFLOW_STATUS values",
      { fromStatus, toStatus }
    );
  }

  const payload = isPlainObject(partial.payload) ? partial.payload : {};
  const payloadFingerprint = isNonEmptyString(partial.payloadFingerprint)
    ? String(partial.payloadFingerprint).trim()
    : createWorkflowPayloadFingerprint(payload);

  // eventId must be supplied (or built by caller via buildWorkflowEventId /
  // eventIdFactory). Kernel never invents wall-clock or random identities.
  const eventId = isNonEmptyString(partial.eventId)
    ? String(partial.eventId).trim()
    : "";
  if (!eventId) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "eventId must be supplied on WorkflowEvent; use buildWorkflowEventId or eventIdFactory",
      {
        eventType,
        workflowInstanceId,
        transitionId,
        idempotencyKey,
      }
    );
  }

  return Object.freeze({
    eventId,
    eventType,
    occurredAt,
    workflowInstanceId,
    definitionId,
    definitionVersion,
    transitionId,
    fromStepId,
    toStepId,
    fromStatus,
    toStatus,
    actorId:
      partial.actorId == null || partial.actorId === ""
        ? null
        : String(partial.actorId),
    actorType:
      partial.actorType == null || partial.actorType === ""
        ? null
        : String(partial.actorType),
    idempotencyKey,
    correlationId:
      partial.correlationId == null || partial.correlationId === ""
        ? null
        : String(partial.correlationId),
    reasonCode:
      partial.reasonCode == null || partial.reasonCode === ""
        ? null
        : String(partial.reasonCode),
    payloadFingerprint,
    payload: Object.freeze(
      /** @type {Record<string, unknown>} */ (deepFreezeClone(payload))
    ),
  });
}
