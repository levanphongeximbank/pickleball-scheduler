/**
 * CORE-19 — workflow control result contract.
 */

import {
  deepFreezeClone,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";
import { createTransitionExplanation } from "./transitionExplanation.js";
import { createWorkflowEvent } from "./workflowEvent.js";
import { createWorkflowState } from "./workflowState.js";

/**
 * @typedef {Object} WorkflowControlResult
 * @property {boolean} ok
 * @property {boolean} [duplicate]
 * @property {boolean} [noop]
 * @property {string|null} code
 * @property {Readonly<import('./workflowState.js').WorkflowState>|null} state
 * @property {ReadonlyArray<import('./workflowEvent.js').WorkflowEvent>} events
 * @property {Readonly<import('./transitionExplanation.js').TransitionExplanation>} explanation
 * @property {string|null} [correlationId]
 * @property {string|null} [idempotencyKey]
 * @property {Readonly<Record<string, unknown>>} [details]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<WorkflowControlResult>}
 */
export function createWorkflowControlResult(partial = {}) {
  const input = isPlainObject(partial) ? partial : {};
  const events = Array.isArray(input.events)
    ? input.events.map((e) => createWorkflowEvent(e))
    : [];

  return Object.freeze({
    ok: input.ok === true,
    duplicate: input.duplicate === true,
    noop: input.noop === true,
    code: input.code == null || input.code === "" ? null : String(input.code),
    state: input.state == null ? null : createWorkflowState(input.state),
    events: Object.freeze([...events]),
    explanation: createTransitionExplanation(input.explanation || {}),
    correlationId:
      input.correlationId == null || input.correlationId === ""
        ? null
        : String(input.correlationId),
    idempotencyKey:
      input.idempotencyKey == null || input.idempotencyKey === ""
        ? null
        : String(input.idempotencyKey),
    details: Object.freeze(
      /** @type {Record<string, unknown>} */ (
        deepFreezeClone(isPlainObject(input.details) ? input.details : {})
      )
    ),
  });
}
