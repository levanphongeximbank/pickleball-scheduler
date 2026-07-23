/**
 * CORE-19 — workflow transition definition contract.
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
 * @typedef {Object} WorkflowTransitionDefinition
 * @property {string} transitionId
 * @property {string} fromStepId
 * @property {string} toStepId
 * @property {string} fromStatus
 * @property {string} toStatus
 * @property {boolean} [requiresRunning]
 * @property {ReadonlyArray<string>} [allowedFromStatuses]
 * @property {ReadonlyArray<object>} [effects]
 * @property {boolean} [allowOptionalEffectFailure]
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<WorkflowTransitionDefinition>}
 */
export function createWorkflowTransitionDefinition(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION,
      "WorkflowTransitionDefinition must be a plain object",
      {}
    );
  }
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

  if (!transitionId || !fromStepId || !toStepId) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION,
      "transitionId, fromStepId, and toStepId are required",
      { transitionId, fromStepId, toStepId }
    );
  }
  if (!isWorkflowStatus(fromStatus) || !isWorkflowStatus(toStatus)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION,
      "fromStatus and toStatus must be CORE-19 WORKFLOW_STATUS values",
      { fromStatus: partial.fromStatus, toStatus: partial.toStatus }
    );
  }

  const allowedFromStatuses = Array.isArray(partial.allowedFromStatuses)
    ? partial.allowedFromStatuses.map((s) => String(s).trim().toUpperCase())
    : [fromStatus];
  for (const status of allowedFromStatuses) {
    if (!isWorkflowStatus(status)) {
      throw new WorkflowError(
        WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION,
        "allowedFromStatuses must contain only CORE-19 WORKFLOW_STATUS values",
        { status }
      );
    }
  }

  return Object.freeze({
    transitionId,
    fromStepId,
    toStepId,
    fromStatus,
    toStatus,
    requiresRunning: partial.requiresRunning === true,
    allowedFromStatuses: Object.freeze([...allowedFromStatuses]),
    effects: Object.freeze(
      Array.isArray(partial.effects)
        ? partial.effects.map((effect) =>
            isPlainObject(effect) ? deepFreezeClone(effect) : effect
          )
        : []
    ),
    allowOptionalEffectFailure: partial.allowOptionalEffectFailure === true,
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
 * @returns {asserts value is WorkflowTransitionDefinition}
 */
export function assertWorkflowTransitionDefinition(value) {
  createWorkflowTransitionDefinition(value);
}
