/**
 * CORE-19 — workflow runtime state contract.
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
 * @typedef {Object} WorkflowState
 * @property {string} workflowInstanceId
 * @property {string} definitionId
 * @property {string} definitionVersion
 * @property {string} currentStepId
 * @property {string} status
 * @property {number} revision
 * @property {number} [restartCount]
 * @property {string|null} [previousStepId]
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<WorkflowState>}
 */
export function createWorkflowState(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.UNKNOWN_STATE,
      "WorkflowState must be a plain object",
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
  const currentStepId = isNonEmptyString(partial.currentStepId)
    ? String(partial.currentStepId).trim()
    : "";
  const status = isNonEmptyString(partial.status)
    ? String(partial.status).trim().toUpperCase()
    : "";

  if (!workflowInstanceId) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.UNKNOWN_STATE,
      "workflowInstanceId is required",
      {}
    );
  }
  if (!definitionId || !definitionVersion) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.UNKNOWN_WORKFLOW,
      "definitionId and definitionVersion are required on WorkflowState",
      { definitionId, definitionVersion }
    );
  }
  if (!currentStepId) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.UNKNOWN_STEP,
      "currentStepId is required",
      {}
    );
  }
  if (!isWorkflowStatus(status)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.UNKNOWN_STATE,
      "WorkflowState.status must be a CORE-19 WORKFLOW_STATUS",
      { status: partial.status }
    );
  }

  const revision = Number(partial.revision);
  const restartCount = Number(partial.restartCount);
  const previousStepId = isNonEmptyString(partial.previousStepId)
    ? String(partial.previousStepId).trim()
    : null;

  return Object.freeze({
    workflowInstanceId,
    definitionId,
    definitionVersion,
    currentStepId,
    status,
    revision: Number.isInteger(revision) && revision >= 0 ? revision : 0,
    restartCount:
      Number.isInteger(restartCount) && restartCount >= 0 ? restartCount : 0,
    previousStepId,
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
 * @returns {Readonly<WorkflowState>}
 */
export function assertWorkflowState(value) {
  return createWorkflowState(value);
}
