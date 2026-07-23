/**
 * CORE-19 — workflow resume request contract.
 * Workflow-level only; does not call CORE-15 match resume.
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { WorkflowError } from "../errors/WorkflowError.js";
import {
  deepFreezeClone,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";
import { createTransitionAuthorizationDecision } from "./workflowDecisions.js";
import {
  WORKFLOW_CONTROL_OPERATION,
  createWorkflowControlRequest,
} from "./workflowControlRequest.js";

/**
 * @typedef {Object} WorkflowResumeRequest
 * @property {"RESUME"} operation
 * @property {string|null} [workflowInstanceId]
 * @property {string} idempotencyKey
 * @property {string|null} [correlationId]
 * @property {string|null} [reasonCode]
 * @property {string|null} [reason]
 * @property {string|null} [actorId]
 * @property {string|null} [actorType]
 * @property {Readonly<import('./workflowDecisions.js').TransitionAuthorizationDecision>|null} [authorization]
 * @property {Readonly<Record<string, unknown>>} [payload]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<WorkflowResumeRequest>}
 */
export function createWorkflowResumeRequest(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_RESUME_REQUEST,
      "WorkflowResumeRequest must be a plain object",
      {}
    );
  }

  const reason =
    partial.reason == null || partial.reason === ""
      ? null
      : String(partial.reason);
  const reasonCode =
    partial.reasonCode == null || partial.reasonCode === ""
      ? null
      : String(partial.reasonCode);
  if (!reason && !reasonCode) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_RESUME_REQUEST,
      "Resume requires reason or reasonCode",
      {}
    );
  }

  const base = createWorkflowControlRequest({
    ...partial,
    operation: WORKFLOW_CONTROL_OPERATION.RESUME,
    reason,
    reasonCode,
  });

  return Object.freeze({
    ...base,
    operation: WORKFLOW_CONTROL_OPERATION.RESUME,
    authorization:
      partial.authorization == null
        ? null
        : createTransitionAuthorizationDecision(partial.authorization),
    payload: Object.freeze(
      /** @type {Record<string, unknown>} */ (
        deepFreezeClone(isPlainObject(partial.payload) ? partial.payload : {})
      )
    ),
  });
}

/**
 * @param {unknown} value
 * @returns {Readonly<WorkflowResumeRequest>}
 */
export function assertWorkflowResumeRequest(value) {
  return createWorkflowResumeRequest(value);
}
