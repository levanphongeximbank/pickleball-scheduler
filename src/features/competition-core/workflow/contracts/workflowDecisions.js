/**
 * CORE-19 — authorization / prerequisite / guard decision contracts.
 *
 * Dependency references may cite future CORE-18 standings outcomes.
 * STANDINGS_UNRESOLVED_TIE policy (future adapter; not executed here):
 * non-blocking only when standings ok + empty typedErrors + complete
 * deterministic final ranking with stable positions for every entry;
 * otherwise must block workflow completion. No replacement tie-break in CORE-19.
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { WorkflowError } from "../errors/WorkflowError.js";
import {
  deepFreezeClone,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";

/**
 * @typedef {Object} TransitionAuthorizationDecision
 * @property {boolean} allowed
 * @property {string|null} [actorId]
 * @property {string|null} [actorType]
 * @property {string|null} [decisionCode]
 * @property {string|null} [reason]
 * @property {Readonly<Record<string, unknown>>} [details]
 */

/**
 * @typedef {Object} TransitionPrerequisiteResult
 * @property {boolean} satisfied
 * @property {string|null} [code]
 * @property {string|null} [message]
 * @property {string|null} [dependencyRef]
 * @property {Readonly<Record<string, unknown>>} [details]
 */

/**
 * @typedef {Object} TransitionGuardDecision
 * @property {boolean} allowed
 * @property {string|null} [code]
 * @property {string|null} [message]
 * @property {string|null} [dependencyRef]
 * @property {Readonly<Record<string, unknown>>} [details]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<TransitionAuthorizationDecision>}
 */
export function createTransitionAuthorizationDecision(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.TRANSITION_UNAUTHORIZED,
      "TransitionAuthorizationDecision must be a plain object",
      {}
    );
  }
  return Object.freeze({
    allowed: partial.allowed === true,
    actorId:
      partial.actorId == null || partial.actorId === ""
        ? null
        : String(partial.actorId),
    actorType:
      partial.actorType == null || partial.actorType === ""
        ? null
        : String(partial.actorType),
    decisionCode:
      partial.decisionCode == null || partial.decisionCode === ""
        ? null
        : String(partial.decisionCode),
    reason:
      partial.reason == null || partial.reason === ""
        ? null
        : String(partial.reason),
    details: Object.freeze(
      /** @type {Record<string, unknown>} */ (
        deepFreezeClone(isPlainObject(partial.details) ? partial.details : {})
      )
    ),
  });
}

/**
 * @param {unknown} partial
 * @returns {Readonly<TransitionPrerequisiteResult>}
 */
export function createTransitionPrerequisiteResult(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
      "TransitionPrerequisiteResult must be a plain object",
      {}
    );
  }
  return Object.freeze({
    satisfied: partial.satisfied === true,
    code:
      partial.code == null || partial.code === "" ? null : String(partial.code),
    message:
      partial.message == null || partial.message === ""
        ? null
        : String(partial.message),
    dependencyRef:
      partial.dependencyRef == null || partial.dependencyRef === ""
        ? null
        : String(partial.dependencyRef),
    details: Object.freeze(
      /** @type {Record<string, unknown>} */ (
        deepFreezeClone(isPlainObject(partial.details) ? partial.details : {})
      )
    ),
  });
}

/**
 * @param {unknown} partial
 * @returns {Readonly<TransitionGuardDecision>}
 */
export function createTransitionGuardDecision(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.GUARD_REJECTED,
      "TransitionGuardDecision must be a plain object",
      {}
    );
  }
  return Object.freeze({
    allowed: partial.allowed === true,
    code:
      partial.code == null || partial.code === "" ? null : String(partial.code),
    message:
      partial.message == null || partial.message === ""
        ? null
        : String(partial.message),
    dependencyRef:
      partial.dependencyRef == null || partial.dependencyRef === ""
        ? null
        : String(partial.dependencyRef),
    details: Object.freeze(
      /** @type {Record<string, unknown>} */ (
        deepFreezeClone(isPlainObject(partial.details) ? partial.details : {})
      )
    ),
  });
}
