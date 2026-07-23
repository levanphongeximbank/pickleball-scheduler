import { CORE02_POLICY_ID } from "../constants/versions.js";
import { AUTHORIZATION_DECISION_CODE } from "../enums/denyReasons.js";
import {
  AUTHORIZATION_ERROR_CODE,
  AuthorizationError,
} from "../errors/index.js";
import { createAuthorizationExplanation } from "./authorizationExplanation.js";
import {
  freezeRecord,
  isPlainObject,
  optionalNonEmptyString,
} from "./shared.js";

/**
 * @typedef {Object} AuthorizationDecision
 * @property {boolean} allowed
 * @property {string} decisionCode
 * @property {string|null} [reason]
 * @property {string|null} [denyReason]
 * @property {string|null} [actorId]
 * @property {string|null} [actorRole]
 * @property {string|null} [policyId]
 * @property {string|null} [action]
 * @property {Readonly<import('./authorizationExplanation.js').AuthorizationExplanation>|null} [explanation]
 * @property {Readonly<Record<string, unknown>>} [details]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<AuthorizationDecision>}
 */
export function createAuthorizationDecision(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationDecision must be a plain object",
      {}
    );
  }
  const allowed = partial.allowed === true;
  const denyReason = optionalNonEmptyString(partial.denyReason);
  let decisionCode = optionalNonEmptyString(partial.decisionCode);
  if (allowed) {
    decisionCode = decisionCode || AUTHORIZATION_DECISION_CODE.ALLOW;
  } else {
    // Denied decisions must never retain ALLOW as decisionCode.
    if (!decisionCode || decisionCode === AUTHORIZATION_DECISION_CODE.ALLOW) {
      decisionCode =
        denyReason || AUTHORIZATION_DECISION_CODE.PERMISSION_DENIED;
    }
  }

  return Object.freeze({
    allowed,
    decisionCode,
    reason: optionalNonEmptyString(partial.reason),
    denyReason: allowed ? null : denyReason || decisionCode,
    actorId: optionalNonEmptyString(partial.actorId),
    actorRole: optionalNonEmptyString(partial.actorRole),
    policyId: optionalNonEmptyString(partial.policyId) || CORE02_POLICY_ID,
    action: optionalNonEmptyString(partial.action),
    explanation: isPlainObject(partial.explanation)
      ? createAuthorizationExplanation(partial.explanation)
      : null,
    details: freezeRecord(partial.details),
  });
}
