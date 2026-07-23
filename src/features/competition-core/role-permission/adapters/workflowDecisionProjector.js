import { CORE02_POLICY_ID } from "../constants/versions.js";
import {
  createAuthorizationDecision,
  isPlainObject,
  optionalNonEmptyString,
} from "../contracts/index.js";

/**
 * Project CORE-02 AuthorizationDecision → TransitionAuthorizationDecision shape.
 *
 * @param {unknown} decision
 * @returns {{
 *   allowed: boolean,
 *   actorId: string|null,
 *   actorType: string|null,
 *   decisionCode: string|null,
 *   reason: string|null,
 *   details: Record<string, unknown>,
 * }}
 */
export function projectToTransitionAuthorizationDecision(decision) {
  const normalized = isPlainObject(decision)
    ? createAuthorizationDecision(decision)
    : createAuthorizationDecision({
        allowed: false,
        denyReason: "INVALID_REQUEST",
        reason: "Workflow projection requires AuthorizationDecision",
      });

  return Object.freeze({
    allowed: normalized.allowed === true,
    actorId: optionalNonEmptyString(normalized.actorId),
    actorType: optionalNonEmptyString(normalized.actorRole),
    decisionCode: optionalNonEmptyString(normalized.decisionCode),
    reason: optionalNonEmptyString(normalized.reason),
    details: Object.freeze({
      ...(normalized.details || {}),
      policyId: CORE02_POLICY_ID,
      core02DenyReason: normalized.denyReason,
      core02Explanation: normalized.explanation,
    }),
  });
}
