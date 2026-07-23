/**
 * CORE-19 — workflow restart request contract.
 * Deliberate restart to an allowed step only. No CORE-23 recovery.
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { WorkflowError } from "../errors/WorkflowError.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";
import { createTransitionAuthorizationDecision } from "./workflowDecisions.js";
import {
  WORKFLOW_CONTROL_OPERATION,
  createWorkflowControlRequest,
} from "./workflowControlRequest.js";

export const WORKFLOW_RESTART_MODE = Object.freeze({
  TARGET_STEP: "TARGET_STEP",
  INITIAL_STEP: "INITIAL_STEP",
});

/** @type {ReadonlySet<string>} */
export const WORKFLOW_RESTART_MODE_VALUES = new Set(
  Object.values(WORKFLOW_RESTART_MODE)
);

/**
 * @typedef {Object} WorkflowRestartRequest
 * @property {"RESTART"} operation
 * @property {string|null} [workflowInstanceId]
 * @property {string} idempotencyKey
 * @property {string|null} [correlationId]
 * @property {string|null} [reasonCode]
 * @property {string|null} [reason]
 * @property {string|null} [actorId]
 * @property {string|null} [actorType]
 * @property {string|null} [targetStepId]
 * @property {string} [restartMode]
 * @property {Readonly<import('./workflowDecisions.js').TransitionAuthorizationDecision>|null} [authorization]
 * @property {Readonly<Record<string, unknown>>} [payload]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<WorkflowRestartRequest>}
 */
export function createWorkflowRestartRequest(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_RESTART_REQUEST,
      "WorkflowRestartRequest must be a plain object",
      {}
    );
  }

  const restartMode = isNonEmptyString(partial.restartMode)
    ? String(partial.restartMode).trim().toUpperCase()
    : partial.targetStepId
      ? WORKFLOW_RESTART_MODE.TARGET_STEP
      : WORKFLOW_RESTART_MODE.INITIAL_STEP;

  if (!WORKFLOW_RESTART_MODE_VALUES.has(restartMode)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_RESTART_REQUEST,
      "Invalid restartMode",
      { restartMode: partial.restartMode }
    );
  }

  const targetStepId = isNonEmptyString(partial.targetStepId)
    ? String(partial.targetStepId).trim()
    : null;

  if (restartMode === WORKFLOW_RESTART_MODE.TARGET_STEP && !targetStepId) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_RESTART_REQUEST,
      "targetStepId is required for TARGET_STEP restart mode",
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
      WORKFLOW_ERROR_CODE.INVALID_RESTART_REQUEST,
      "Restart requires reason or reasonCode",
      {}
    );
  }

  const base = createWorkflowControlRequest({
    ...partial,
    operation: WORKFLOW_CONTROL_OPERATION.RESTART,
    reason,
    reasonCode,
  });

  return Object.freeze({
    ...base,
    operation: WORKFLOW_CONTROL_OPERATION.RESTART,
    targetStepId,
    restartMode,
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
 * @returns {Readonly<WorkflowRestartRequest>}
 */
export function assertWorkflowRestartRequest(value) {
  return createWorkflowRestartRequest(value);
}
