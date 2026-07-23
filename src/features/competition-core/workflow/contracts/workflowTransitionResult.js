/**
 * CORE-19 — evaluate / apply transition result contracts.
 */

import {
  deepFreezeClone,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";
import { createTransitionExplanation } from "./transitionExplanation.js";
import { createWorkflowEvent } from "./workflowEvent.js";
import { createWorkflowState } from "./workflowState.js";

/**
 * @typedef {Object} WorkflowEvaluationResult
 * @property {boolean} ok
 * @property {boolean} approved
 * @property {string|null} code
 * @property {string} transitionId
 * @property {string|null} fromStepId
 * @property {string|null} toStepId
 * @property {string|null} fromStatus
 * @property {string|null} toStatus
 * @property {Readonly<import('./transitionExplanation.js').TransitionExplanation>} explanation
 * @property {Readonly<Record<string, unknown>>} [details]
 */

/**
 * @typedef {Object} WorkflowTransitionResult
 * @property {boolean} ok
 * @property {Readonly<import('./workflowState.js').WorkflowState>|null} state
 * @property {ReadonlyArray<import('./workflowEvent.js').WorkflowEvent>} events
 * @property {Readonly<import('./transitionExplanation.js').TransitionExplanation>} explanation
 * @property {Readonly<WorkflowEvaluationResult>} evaluation
 * @property {string|null} correlationId
 * @property {string|null} idempotencyKey
 * @property {string|null} code
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<WorkflowEvaluationResult>}
 */
export function createWorkflowEvaluationResult(partial = {}) {
  const input = isPlainObject(partial) ? partial : {};
  return Object.freeze({
    ok: input.ok === true,
    approved: input.approved === true,
    code: input.code == null || input.code === "" ? null : String(input.code),
    transitionId: String(input.transitionId || ""),
    fromStepId:
      input.fromStepId == null || input.fromStepId === ""
        ? null
        : String(input.fromStepId),
    toStepId:
      input.toStepId == null || input.toStepId === ""
        ? null
        : String(input.toStepId),
    fromStatus:
      input.fromStatus == null || input.fromStatus === ""
        ? null
        : String(input.fromStatus),
    toStatus:
      input.toStatus == null || input.toStatus === ""
        ? null
        : String(input.toStatus),
    explanation: createTransitionExplanation(input.explanation || {}),
    details: Object.freeze(
      /** @type {Record<string, unknown>} */ (
        deepFreezeClone(isPlainObject(input.details) ? input.details : {})
      )
    ),
  });
}

/**
 * @param {unknown} partial
 * @returns {Readonly<WorkflowTransitionResult>}
 */
export function createWorkflowTransitionResult(partial = {}) {
  const input = isPlainObject(partial) ? partial : {};
  const events = Array.isArray(input.events)
    ? input.events.map((e) => createWorkflowEvent(e))
    : [];
  return Object.freeze({
    ok: input.ok === true,
    state: input.state == null ? null : createWorkflowState(input.state),
    events: Object.freeze([...events]),
    explanation: createTransitionExplanation(input.explanation || {}),
    evaluation: createWorkflowEvaluationResult(input.evaluation || {}),
    correlationId:
      input.correlationId == null || input.correlationId === ""
        ? null
        : String(input.correlationId),
    idempotencyKey:
      input.idempotencyKey == null || input.idempotencyKey === ""
        ? null
        : String(input.idempotencyKey),
    code: input.code == null || input.code === "" ? null : String(input.code),
  });
}
