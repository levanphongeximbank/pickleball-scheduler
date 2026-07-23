/**
 * CORE-19 — transition request contract.
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { WorkflowError } from "../errors/WorkflowError.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";

/**
 * @typedef {Object} WorkflowTransitionRequest
 * @property {string} transitionId
 * @property {string|null} [workflowInstanceId]
 * @property {string} idempotencyKey
 * @property {string|null} [correlationId]
 * @property {string|null} [reasonCode]
 * @property {Readonly<Record<string, unknown>>} [payload]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<WorkflowTransitionRequest>}
 */
export function createWorkflowTransitionRequest(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "WorkflowTransitionRequest must be a plain object",
      {}
    );
  }

  const transitionId = isNonEmptyString(partial.transitionId)
    ? String(partial.transitionId).trim()
    : "";
  const idempotencyKey = isNonEmptyString(partial.idempotencyKey)
    ? String(partial.idempotencyKey).trim()
    : "";

  if (!transitionId) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.UNKNOWN_TRANSITION,
      "transitionId is required",
      {}
    );
  }
  if (!idempotencyKey) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "idempotencyKey is required",
      {}
    );
  }

  return Object.freeze({
    transitionId,
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
    payload: Object.freeze(
      /** @type {Record<string, unknown>} */ (
        deepFreezeClone(isPlainObject(partial.payload) ? partial.payload : {})
      )
    ),
  });
}

/**
 * @param {unknown} value
 * @returns {Readonly<WorkflowTransitionRequest>}
 */
export function assertWorkflowTransitionRequest(value) {
  return createWorkflowTransitionRequest(value);
}
