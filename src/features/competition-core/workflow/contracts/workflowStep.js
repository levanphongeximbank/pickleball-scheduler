/**
 * CORE-19 — workflow step contract.
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { WorkflowError } from "../errors/WorkflowError.js";
import { isWorkflowStatus } from "../enums/workflowStatuses.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";

/**
 * @typedef {Object} WorkflowStep
 * @property {string} stepId
 * @property {string} status
 * @property {string|null} [name]
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<WorkflowStep>}
 */
export function createWorkflowStep(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION,
      "WorkflowStep must be a plain object",
      {}
    );
  }
  const stepId = isNonEmptyString(partial.stepId)
    ? String(partial.stepId).trim()
    : "";
  const status = isNonEmptyString(partial.status)
    ? String(partial.status).trim().toUpperCase()
    : "";
  if (!stepId) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION,
      "WorkflowStep.stepId is required",
      {}
    );
  }
  if (!isWorkflowStatus(status)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION,
      "WorkflowStep.status must be a CORE-19 WORKFLOW_STATUS",
      { status: partial.status }
    );
  }
  return Object.freeze({
    stepId,
    status,
    name:
      partial.name == null || partial.name === ""
        ? null
        : String(partial.name),
    metadata: Object.freeze(
      /** @type {Record<string, unknown>} */ (
        deepFreezeClone(
          isPlainObject(partial.metadata) ? partial.metadata : {}
        )
      )
    ),
  });
}

/**
 * @param {unknown} value
 * @returns {asserts value is WorkflowStep}
 */
export function assertWorkflowStep(value) {
  createWorkflowStep(value);
}
