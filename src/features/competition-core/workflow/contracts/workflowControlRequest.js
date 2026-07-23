/**
 * CORE-19 — workflow control request contracts (pause/fail/complete base).
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { WorkflowError } from "../errors/WorkflowError.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";

export const WORKFLOW_CONTROL_OPERATION = Object.freeze({
  PAUSE: "PAUSE",
  RESUME: "RESUME",
  RESTART: "RESTART",
  FAIL: "FAIL",
  COMPLETE: "COMPLETE",
  TRANSITION: "TRANSITION",
});

/** @type {ReadonlySet<string>} */
export const WORKFLOW_CONTROL_OPERATION_VALUES = new Set(
  Object.values(WORKFLOW_CONTROL_OPERATION)
);

/**
 * @typedef {Object} WorkflowControlRequest
 * @property {string} operation
 * @property {string|null} [workflowInstanceId]
 * @property {string} idempotencyKey
 * @property {string|null} [correlationId]
 * @property {string|null} [reasonCode]
 * @property {string|null} [reason]
 * @property {string|null} [actorId]
 * @property {string|null} [actorType]
 * @property {Readonly<Record<string, unknown>>} [payload]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<WorkflowControlRequest>}
 */
export function createWorkflowControlRequest(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "WorkflowControlRequest must be a plain object",
      {}
    );
  }

  const operation = isNonEmptyString(partial.operation)
    ? String(partial.operation).trim().toUpperCase()
    : "";
  if (!WORKFLOW_CONTROL_OPERATION_VALUES.has(operation)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "Invalid workflow control operation",
      { operation: partial.operation }
    );
  }

  const idempotencyKey = isNonEmptyString(partial.idempotencyKey)
    ? String(partial.idempotencyKey).trim()
    : "";
  if (!idempotencyKey) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "idempotencyKey is required on WorkflowControlRequest",
      {}
    );
  }

  return Object.freeze({
    operation,
    workflowInstanceId:
      partial.workflowInstanceId == null || partial.workflowInstanceId === ""
        ? null
        : String(partial.workflowInstanceId),
    idempotencyKey,
    correlationId:
      partial.correlationId == null || partial.correlationId === ""
        ? null
        : String(partial.correlationId),
    reasonCode:
      partial.reasonCode == null || partial.reasonCode === ""
        ? null
        : String(partial.reasonCode),
    reason:
      partial.reason == null || partial.reason === ""
        ? null
        : String(partial.reason),
    actorId:
      partial.actorId == null || partial.actorId === ""
        ? null
        : String(partial.actorId),
    actorType:
      partial.actorType == null || partial.actorType === ""
        ? null
        : String(partial.actorType),
    payload: Object.freeze(
      /** @type {Record<string, unknown>} */ (
        deepFreezeClone(isPlainObject(partial.payload) ? partial.payload : {})
      )
    ),
  });
}

/**
 * @param {unknown} value
 * @returns {Readonly<WorkflowControlRequest>}
 */
export function assertWorkflowControlRequest(value) {
  return createWorkflowControlRequest(value);
}
