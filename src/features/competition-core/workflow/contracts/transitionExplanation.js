/**
 * CORE-19 — transition explanation (machine + human readable).
 * Shape aligned with competition-core explanation conventions (code/message/details).
 */

import {
  deepFreezeClone,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";

/**
 * @typedef {Object} TransitionExplanation
 * @property {string} code
 * @property {string} message
 * @property {Readonly<Record<string, unknown>>} details
 * @property {ReadonlyArray<string>} guardReasons
 * @property {ReadonlyArray<string>} prerequisiteReasons
 * @property {string|null} authorizationReason
 * @property {ReadonlyArray<string>} dependencyReferences
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<TransitionExplanation>}
 */
export function createTransitionExplanation(partial = {}) {
  const input = isPlainObject(partial) ? partial : {};
  const guardReasons = Array.isArray(input.guardReasons)
    ? input.guardReasons.map((r) => String(r))
    : [];
  const prerequisiteReasons = Array.isArray(input.prerequisiteReasons)
    ? input.prerequisiteReasons.map((r) => String(r))
    : [];
  const dependencyReferences = Array.isArray(input.dependencyReferences)
    ? input.dependencyReferences.map((r) => String(r))
    : [];

  return Object.freeze({
    code: String(input.code || "WORKFLOW_TRANSITION"),
    message: String(input.message || ""),
    details: Object.freeze(
      /** @type {Record<string, unknown>} */ (
        deepFreezeClone(isPlainObject(input.details) ? input.details : {})
      )
    ),
    guardReasons: Object.freeze([...guardReasons]),
    prerequisiteReasons: Object.freeze([...prerequisiteReasons]),
    authorizationReason:
      input.authorizationReason == null || input.authorizationReason === ""
        ? null
        : String(input.authorizationReason),
    dependencyReferences: Object.freeze([...dependencyReferences]),
  });
}
